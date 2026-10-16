package live

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const defaultModel = "gemini-3.8-live"

var (
	ErrNotConfigured = errors.New("Gemini Live is not configured")
	ErrProvider      = errors.New("Gemini token service failed")
)

type Token struct {
	Name  string `json:"token"`
	Model string `json:"model"`
}

type TokenIssuer struct {
	apiKey   string
	model    string
	endpoint string
	client   *http.Client
}

type tokenRequest struct {
	Uses                     int       `json:"uses"`
	ExpireTime               time.Time `json:"expireTime"`
	NewSessionExpireTime     time.Time `json:"newSessionExpireTime"`
	BidiGenerateContentSetup struct {
		Model            string `json:"model"`
		GenerationConfig struct {
			ResponseModalities []string `json:"responseModalities"`
		} `json:"generationConfig"`
		SessionResumption struct{} `json:"sessionResumption"`
	} `json:"bidiGenerateContentSetup"`
}

func NewTokenIssuer(apiKey, model string, client *http.Client) *TokenIssuer {
	model = strings.TrimSpace(model)
	if model == "" {
		model = defaultModel
	}
	model = strings.TrimPrefix(model, "models/")
	if client == nil {
		client = defaultClient()
	}

	return &TokenIssuer{
		apiKey:   strings.TrimSpace(apiKey),
		model:    strings.TrimSpace(model),
		endpoint: "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
		client:   client,
	}
}

// defaultClient dials Google over IPv4 first. Broken IPv6 routes (VPN tunnels such as WARP)
// otherwise connect and then hang or reset mid-request, which Go's dual-stack dialer can't recover from.
func defaultClient() *http.Client {
	dialer := &net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSHandshakeTimeout = 5 * time.Second
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		if network != "tcp" {
			return dialer.DialContext(ctx, network, address)
		}
		conn, err := dialer.DialContext(ctx, "tcp4", address)
		if err == nil {
			return conn, nil
		}
		return dialer.DialContext(ctx, "tcp6", address)
	}
	return &http.Client{Timeout: 6 * time.Second, Transport: transport}
}

func (i *TokenIssuer) Configured() bool {
	return i != nil && i.apiKey != ""
}

func (i *TokenIssuer) CreateToken(ctx context.Context) (Token, error) {
	if !i.Configured() {
		return Token{}, ErrNotConfigured
	}

	now := time.Now().UTC()
	requestBody := tokenRequest{
		Uses:                 1,
		ExpireTime:           now.Add(15 * time.Minute),
		NewSessionExpireTime: now.Add(time.Minute),
	}
	requestBody.BidiGenerateContentSetup.Model = "models/" + i.model
	requestBody.BidiGenerateContentSetup.GenerationConfig.ResponseModalities = []string{"AUDIO"}

	encoded, err := json.Marshal(requestBody)
	if err != nil {
		return Token{}, fmt.Errorf("encode Gemini token request: %w", err)
	}

	// A network failure gets one retry on a fresh connection; provider errors are returned as they are.
	// Two 6 s attempts stay inside the HTTP server's 15 s write timeout.
	var response *http.Response
	for attempt := 1; ; attempt++ {
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, i.endpoint, bytes.NewReader(encoded))
		if err != nil {
			return Token{}, fmt.Errorf("build Gemini token request: %w", err)
		}
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("x-goog-api-key", i.apiKey)

		response, err = i.client.Do(request)
		if err == nil {
			break
		}
		if attempt >= 2 || ctx.Err() != nil {
			return Token{}, fmt.Errorf("request Gemini Live token: %w", err)
		}
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return Token{}, fmt.Errorf("%w: read response", ErrProvider)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		var providerError struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.Unmarshal(responseBody, &providerError)
		reason := strings.TrimSpace(providerError.Error.Message)
		if len(reason) > 300 {
			reason = reason[:300]
		}
		if reason != "" {
			return Token{}, fmt.Errorf("%w: status %d: %s", ErrProvider, response.StatusCode, reason)
		}
		return Token{}, fmt.Errorf("%w: status %d", ErrProvider, response.StatusCode)
	}

	var result struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(bytes.NewReader(responseBody)).Decode(&result); err != nil {
		return Token{}, fmt.Errorf("decode Gemini Live token: %w", err)
	}
	if strings.TrimSpace(result.Name) == "" {
		return Token{}, fmt.Errorf("%w: empty token", ErrProvider)
	}

	return Token{Name: result.Name, Model: i.model}, nil
}
