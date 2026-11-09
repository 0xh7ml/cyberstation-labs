FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod tidy || true
COPY . .
RUN go mod tidy && go build -o report-svc .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/report-svc .
EXPOSE 8080
CMD ["./report-svc"]
