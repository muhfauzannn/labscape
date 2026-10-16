package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"labai/apps/api/internal/httpapi"
)

const shutdownTimeout = 10 * time.Second

func main() {
	if err := run(); err != nil {
		slog.Error("API stopped with an error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	addr, err := listenAddress()
	if err != nil {
		return err
	}

	server := httpapi.NewServer(addr)
	serverErrors := make(chan error, 1)

	go func() {
		slog.Info("starting API", "address", addr)
		serverErrors <- server.ListenAndServe()
	}()

	signalContext, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve HTTP: %w", err)
	case <-signalContext.Done():
	}

	shutdownContext, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := server.Shutdown(shutdownContext); err != nil {
		_ = server.Close()
		return fmt.Errorf("shut down HTTP server: %w", err)
	}

	if err := <-serverErrors; !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server exited unexpectedly: %w", err)
	}

	slog.Info("API stopped")
	return nil
}

func listenAddress() (string, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	portNumber, err := strconv.Atoi(port)
	if err != nil || portNumber < 1 || portNumber > 65535 {
		return "", fmt.Errorf("invalid PORT %q: expected an integer from 1 to 65535", port)
	}

	return ":" + strconv.Itoa(portNumber), nil
}
