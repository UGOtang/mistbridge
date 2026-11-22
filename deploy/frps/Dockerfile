FROM oven/bun:1-slim

# frps is a static Go binary. It is copied from the platform release bundle.
COPY frps /usr/local/bin/frps
RUN chmod 0755 /usr/local/bin/frps

EXPOSE 23333
ENTRYPOINT ["/usr/local/bin/frps", "-c", "/etc/frp/frps.toml"]
