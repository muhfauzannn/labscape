package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"labscape/apps/api/internal/live"
)

type stubTokenIssuer struct {
	calls int
}

func (s *stubTokenIssuer) Configured() bool { return true }

func (s *stubTokenIssuer) CreateToken(context.Context) (live.Token, error) {
	s.calls++
	return live.Token{Name: "short-lived-token", Model: "gemini-3.8-live"}, nil
}

func TestLiveTokenRouteChecksOriginAndLimitsRequests(t *testing.T) {
	issuer := &stubTokenIssuer{}
	server := NewServer(":0", issuer, []string{"https://labscape.example"}, false)

	blocked := httptest.NewRequest(http.MethodPost, "/api/live/token", nil)
	blocked.Header.Set("Origin", "https://other.example")
	blocked.RemoteAddr = "203.0.113.7:1234"
	blockedResponse := httptest.NewRecorder()
	server.Handler.ServeHTTP(blockedResponse, blocked)
	if blockedResponse.Code != http.StatusForbidden || issuer.calls != 0 {
		t.Fatalf("untrusted origin response = %d, issuer calls = %d", blockedResponse.Code, issuer.calls)
	}

	withBody := httptest.NewRequest(http.MethodPost, "/api/live/token", strings.NewReader("{}"))
	withBody.Header.Set("Origin", "https://labscape.example")
	withBody.RemoteAddr = "203.0.113.7:1234"
	bodyResponse := httptest.NewRecorder()
	server.Handler.ServeHTTP(bodyResponse, withBody)
	if bodyResponse.Code != http.StatusBadRequest || issuer.calls != 0 {
		t.Fatalf("request body response = %d, issuer calls = %d", bodyResponse.Code, issuer.calls)
	}

	for attempt := 0; attempt < tokenLimit; attempt++ {
		request := httptest.NewRequest(http.MethodPost, "/api/live/token", nil)
		request.Header.Set("Origin", "https://labscape.example")
		request.RemoteAddr = "203.0.113.7:1234"
		response := httptest.NewRecorder()
		server.Handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("attempt %d response = %d, want 200", attempt+1, response.Code)
		}
	}

	limited := httptest.NewRequest(http.MethodPost, "/api/live/token", nil)
	limited.Header.Set("Origin", "https://labscape.example")
	limited.RemoteAddr = "203.0.113.7:1234"
	limitedResponse := httptest.NewRecorder()
	server.Handler.ServeHTTP(limitedResponse, limited)
	if limitedResponse.Code != http.StatusTooManyRequests || limitedResponse.Header().Get("Retry-After") != "60" {
		t.Fatalf("rate limit response = %d, Retry-After = %q", limitedResponse.Code, limitedResponse.Header().Get("Retry-After"))
	}
	if issuer.calls != tokenLimit {
		t.Fatalf("issuer calls = %d, want %d", issuer.calls, tokenLimit)
	}
}

func TestReadinessRequiresGeminiConfiguration(t *testing.T) {
	server := NewServer(":0", nil, nil, false)
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	response := httptest.NewRecorder()
	server.Handler.ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("readiness response = %d, want %d", response.Code, http.StatusServiceUnavailable)
	}
}
