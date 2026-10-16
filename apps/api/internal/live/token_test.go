package live

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestCreateTokenUsesSingleConstrainedAudioSession(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Method != http.MethodPost || request.URL.Path != "/v1beta/auth_tokens" {
			t.Errorf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
		if request.Header.Get("x-goog-api-key") != "secret-key" {
			t.Error("Gemini API key was not sent in the expected header")
		}

		var body struct {
			Uses                 int       `json:"uses"`
			ExpireTime           time.Time `json:"expireTime"`
			NewSessionExpireTime time.Time `json:"newSessionExpireTime"`
			Setup                struct {
				Model            string `json:"model"`
				GenerationConfig struct {
					ResponseModalities []string `json:"responseModalities"`
				} `json:"generationConfig"`
				SessionResumption json.RawMessage `json:"sessionResumption"`
			} `json:"bidiGenerateContentSetup"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Errorf("decode token request: %v", err)
			return &http.Response{StatusCode: http.StatusBadRequest, Body: io.NopCloser(bytes.NewReader(nil)), Header: make(http.Header), Request: request}, nil
		}
		if body.Uses != 1 || body.Setup.Model != "models/gemini-3.8-live" {
			t.Errorf("token is not restricted to one Gemini Live session: %+v", body)
		}
		if len(body.Setup.GenerationConfig.ResponseModalities) != 1 || body.Setup.GenerationConfig.ResponseModalities[0] != "AUDIO" {
			t.Errorf("token does not require audio output: %+v", body.Setup.GenerationConfig)
		}
		if string(body.Setup.SessionResumption) != "{}" {
			t.Errorf("token does not enable session resumption: %s", body.Setup.SessionResumption)
		}
		if time.Until(body.NewSessionExpireTime) < 0 || time.Until(body.NewSessionExpireTime) > 61*time.Second {
			t.Errorf("unexpected new-session expiry: %s", body.NewSessionExpireTime)
		}
		if time.Until(body.ExpireTime) < 14*time.Minute || time.Until(body.ExpireTime) > 16*time.Minute {
			t.Errorf("unexpected session expiry: %s", body.ExpireTime)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(bytes.NewBufferString(`{"name":"ephemeral-live-token"}`)),
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Request:    request,
		}, nil
	})}

	issuer := NewTokenIssuer("secret-key", "gemini-3.8-live", client)
	issuer.endpoint = "https://provider.example/v1beta/auth_tokens"

	token, err := issuer.CreateToken(context.Background())
	if err != nil {
		t.Fatalf("CreateToken() error = %v", err)
	}
	if token.Name != "ephemeral-live-token" || token.Model != "gemini-3.8-live" {
		t.Fatalf("unexpected token response: %+v", token)
	}
}

func TestCreateTokenRequiresAPIKey(t *testing.T) {
	issuer := NewTokenIssuer("", "", nil)
	if _, err := issuer.CreateToken(context.Background()); err != ErrNotConfigured {
		t.Fatalf("CreateToken() error = %v, want %v", err, ErrNotConfigured)
	}
}
