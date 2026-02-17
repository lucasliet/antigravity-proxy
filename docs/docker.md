# Docker Deployment

Run the Antigravity Claude Proxy in a Docker container for easy deployment and isolation.

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/badrisnarayanan/antigravity-claude-proxy.git
cd antigravity-claude-proxy

# Start the container
docker compose up -d

# View logs
docker compose logs -f

# Access WebUI
open http://localhost:8080
```

### Option 2: Docker CLI

```bash
# Build image
docker build -t antigravity-claude-proxy .

# Run container
docker run -d \
  --name antigravity-proxy \
  -p 8080:8080 \
  -v $(pwd)/config:/app/.config/antigravity-proxy \
  --restart unless-stopped \
  antigravity-claude-proxy

# View logs
docker logs -f antigravity-proxy
```

---

## Configuration

### Environment Variables

Configure the container via environment variables in `docker-compose.yml`:

```yaml
environment:
  - PORT=8080              # Server port (default: 8080)
  - HOST=0.0.0.0           # Bind address
  - API_KEY=secret         # Optional: Protect /v1/* endpoints
  - WEBUI_PASSWORD=pass    # Optional: Protect WebUI
  - HTTP_PROXY=http://...  # Optional: Route through proxy
  - FALLBACK=true          # Optional: Enable model fallback
  - STRATEGY=hybrid        # sticky, round-robin, or hybrid
  - DEV_MODE=false         # Optional: Developer mode
```

### Volumes

**Persist account data** (required for multi-account setup):

```yaml
volumes:
  - ./config:/app/.config/antigravity-proxy
```

This volume stores:
- `accounts.json` - Google account OAuth tokens
- `usage-history.json` - 30-day request history

**Mount Claude CLI config** (optional):

```yaml
volumes:
  - ~/.claude:/home/nodejs/.claude:ro
```

Use this if you want the WebUI to read/write your host's Claude settings.

---

## Account Management

### Add Accounts via CLI

```bash
# Enter the container
docker compose exec antigravity-proxy sh

# Run account management (manual OAuth mode)
npm run accounts:add -- --no-browser
```

Copy the OAuth URL, complete authorization in your browser, then paste the authorization code.

### Add Accounts via WebUI

1. Open http://localhost:8080
2. Go to **Accounts** tab
3. Click **Add Account**
4. Complete OAuth in popup (or use Manual mode)

---

## Networking

### Expose to LAN

To access the proxy from other devices on your network:

```yaml
ports:
  - "0.0.0.0:8080:8080"  # Bind to all interfaces
```

**⚠️ Security Warning:** Set `API_KEY` and `WEBUI_PASSWORD` when exposing to network!

### Reverse Proxy (Nginx/Traefik)

```nginx
# Nginx example
location /antigravity/ {
    proxy_pass http://localhost:8080/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

## Production Deployment

### Docker Compose with Secrets

```yaml
version: '3.8'

services:
  antigravity-proxy:
    image: antigravity-claude-proxy:latest
    environment:
      - API_KEY_FILE=/run/secrets/api_key
      - WEBUI_PASSWORD_FILE=/run/secrets/webui_password
    secrets:
      - api_key
      - webui_password
    volumes:
      - proxy-data:/app/.config/antigravity-proxy
    restart: always

secrets:
  api_key:
    file: ./secrets/api_key.txt
  webui_password:
    file: ./secrets/webui_password.txt

volumes:
  proxy-data:
```

### Resource Limits

```yaml
services:
  antigravity-proxy:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

---

## Health Checks

The container includes a built-in health check:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' antigravity-proxy

# Manual health check
docker exec antigravity-proxy curl -f http://localhost:8080/health
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs antigravity-proxy

# Common issues:
# - Port 8080 already in use: Change port in docker-compose.yml
# - Permission issues: Ensure volume mount paths exist and are writable
```

### OAuth callback fails

When running in Docker, OAuth callbacks must reach `http://localhost:51121`. This works fine on the same host, but fails when accessing from a remote machine.

**Solution:** Use the WebUI's "Manual Authorization" mode:
1. Click "Add Account" in WebUI
2. Copy the OAuth URL
3. Complete authorization on your local browser
4. Paste the authorization code back into the WebUI

### Cannot access from other machines

```yaml
# Ensure HOST is set to 0.0.0.0, not 127.0.0.1
environment:
  - HOST=0.0.0.0
```

### Account data not persisting

Ensure the volume is correctly mounted:

```bash
# Check mount
docker inspect antigravity-proxy | grep -A5 Mounts

# Should show something like:
# "Source": "/path/to/config",
# "Destination": "/app/.config/antigravity-proxy"
```

---

## Updating

### Pull Latest Image

```bash
# Pull updates
git pull

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Backup Data

```bash
# Backup account config
cp -r ./config ./config.backup.$(date +%Y%m%d)

# Or use docker cp
docker cp antigravity-proxy:/app/.config/antigravity-proxy ./backup
```

---

## Building Custom Images

### Build with Custom Port

```bash
docker build \
  --build-arg PORT=3000 \
  -t antigravity-claude-proxy:custom .
```

### Multi-Architecture Builds

```bash
# Build for ARM64 (e.g., Raspberry Pi)
docker buildx build \
  --platform linux/arm64 \
  -t antigravity-claude-proxy:arm64 .

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t antigravity-claude-proxy:latest .
```

---

## See Also

- [Configuration](./configuration.md) - Environment variables reference
- [Load Balancing](./load-balancing.md) - Multi-account setup
- [Troubleshooting](./troubleshooting.md) - Common issues
