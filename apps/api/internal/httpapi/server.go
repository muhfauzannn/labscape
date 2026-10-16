package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"labai/apps/api/internal/live"
)

const tokenLimit = 5

type tokenIssuer interface {
	Configured() bool
	CreateToken(context.Context) (live.Token, error)
}

type tokenLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
}

func (l *tokenLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.requests == nil {
		l.requests = make(map[string][]time.Time)
	}

	cutoff := now.Add(-time.Minute)
	for client, requests := range l.requests {
		active := requests[:0]
		for _, requestTime := range requests {
			if requestTime.After(cutoff) {
				active = append(active, requestTime)
			}
		}
		if len(active) == 0 {
			delete(l.requests, client)
		} else {
			l.requests[client] = active
		}
	}

	if len(l.requests[key]) >= tokenLimit {
		return false
	}
	l.requests[key] = append(l.requests[key], now)
	return true
}

func NewServer(addr string, issuer tokenIssuer, allowedOrigins []string, trustProxy bool) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", statusHandler("ok"))
	mux.HandleFunc("GET /readyz", readinessHandler(issuer))
	mux.Handle("POST /api/live/token", liveTokenHandler(issuer, allowedOrigins, trustProxy, &tokenLimiter{}))

	return &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}
}

func readinessHandler(issuer tokenIssuer) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		if issuer == nil || !issuer.Configured() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	}
}

func liveTokenHandler(issuer tokenIssuer, allowedOrigins []string, trustProxy bool, limiter *tokenLimiter) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		origin = strings.TrimSuffix(strings.TrimSpace(origin), "/")
		if origin != "" {
			allowed[origin] = struct{}{}
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if r.ContentLength != 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unexpected_body", "message": "This request does not accept a body."})
			return
		}
		origin := strings.TrimSuffix(strings.TrimSpace(r.Header.Get("Origin")), "/")
		if _, ok := allowed[origin]; origin == "" || !ok {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "origin_not_allowed", "message": "This page cannot start a voice session."})
			return
		}
		if issuer == nil || !issuer.Configured() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voice_not_configured", "message": "The voice assistant is not configured."})
			return
		}
		if !limiter.allow(clientAddress(r, trustProxy), time.Now()) {
			w.Header().Set("Retry-After", "60")
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate_limited", "message": "Please wait a moment before starting another voice session."})
			return
		}

		token, err := issuer.CreateToken(r.Context())
		if err != nil {
			if errors.Is(err, live.ErrNotConfigured) {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "voice_not_configured", "message": "The voice assistant is not configured."})
				return
			}
			if r.Context().Err() != nil {
				return
			}
			slog.Warn("Gemini Live token request failed", "error", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "voice_unavailable", "message": "The voice assistant could not start."})
			return
		}

		writeJSON(w, http.StatusOK, token)
	})
}

func clientAddress(r *http.Request, trustProxy bool) string {
	if trustProxy {
		forwarded := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		for i := len(forwarded) - 1; i >= 0; i-- {
			candidate := strings.TrimSpace(forwarded[i])
			if parsed := net.ParseIP(candidate); parsed != nil {
				return parsed.String()
			}
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func statusHandler(status string) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintf(w, "{\"status\":%q}\n", status)
	}
}
