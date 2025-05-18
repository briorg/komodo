## Builds the Komodo Core and Periphery binaries
## for a specific architecture.

#FROM rust:1.86.0-bullseye AS builder
FROM ghcr.io/rust-cross/rust-musl-cross:x86_64-musl AS builder

WORKDIR /builder
COPY Cargo.toml Cargo.lock ./
COPY ./lib ./lib
COPY ./client/core/rs ./client/core/rs
COPY ./client/periphery ./client/periphery
COPY ./bin/core ./bin/core
COPY ./bin/periphery ./bin/periphery
COPY ./bin/cli ./bin/cli

# Compile bin
RUN \
    cargo build -p komodo_core --release && \
    cargo build -p komodo_periphery --release && \
    cargo build -p komodo_cli --release

# Copy just the binaries to scratch image
FROM scratch

COPY --from=builder /builder/target/x86_64-unknown-linux-musl/release/core /core
COPY --from=builder /builder/target/x86_64-unknown-linux-musl/release/komodo /komodo
COPY --from=builder /builder/target/x86_64-unknown-linux-musl/release/periphery /periphery

LABEL org.opencontainers.image.source=https://github.com/moghtech/komodo
LABEL org.opencontainers.image.description="Komodo Binaries (static)"
LABEL org.opencontainers.image.licenses=GPL-3.0
