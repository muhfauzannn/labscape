FROM golang:1.27.2-alpine AS build

WORKDIR /app
COPY apps/api/go.mod ./
COPY apps/api ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /api ./cmd/api

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /api /usr/local/bin/api
USER 10001:10001
EXPOSE 8080
CMD ["/usr/local/bin/api"]
