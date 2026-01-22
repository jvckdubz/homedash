# HomeDash

Self-hosted dashboard for monitoring services and managing home infrastructure.

## Overview

HomeDash is a web-based dashboard designed for home server environments. It provides a unified interface for monitoring services, tracking payments, managing tasks, and integrating with popular self-hosted applications.

## Features

### Service Monitoring
- Real-time HTTP/HTTPS health checks with configurable intervals
- Visual status indicators (online/offline/degraded)
- Response time tracking
- Support for custom headers and authentication

### Docker Integration
- Container status monitoring via Docker socket
- Portainer integration for multi-environment management
- Display of container states, stacks, and environments

### Integrations
- **Proxmox**: VM and container status
- **Home Assistant**: Entity states and sensor data
- **AdGuard Home**: Blocking statistics
- **qBittorrent**: Download status and speeds
- **Plex/Jellyfin**: Active streams and library stats
- **Pi-hole**: Query and blocking metrics
- **Uptime Kuma**: Monitor status aggregation

### Payment Management
- Track recurring payments and subscriptions
- Payment calendar with due date reminders
- Provider management with card linking
- Export/import functionality

### Tasks and Notes
- Task management with priorities and due dates
- Color-coded notes
- Completion tracking

### Additional Features
- Automatic update notifications via GitHub
- Weather widget with OpenWeatherMap integration
- Telegram notifications for service status changes
- Multi-language support (Russian/English)
- Responsive mobile interface
- Customizable categories and icons
- Dark theme
- PWA support

## Requirements

- Docker and Docker Compose
- Optional: Docker socket access for container monitoring

## Installation

### Docker Compose (recommended)

Create a `docker-compose.yml`:

```yaml
services:
  homedash:
    image: ghcr.io/jvckdubz/homedash:latest
    container_name: homedash
    ports:
      - "3000:3000"
      - "3443:3443"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - TZ=Europe/Moscow
    restart: unless-stopped
```

Start the container:

```bash
docker compose up -d
```

### Docker Run

```bash
docker run -d \
  --name homedash \
  -p 3000:3000 \
  -p 3443:3443 \
  -v $(pwd)/data:/app/data \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e TZ=Europe/Moscow \
  --restart unless-stopped \
  ghcr.io/jvckdubz/homedash:latest
```

### Access

Open `http://localhost:3000` in your browser.

## Configuration

### Volumes

| Path | Description |
|------|-------------|
| `/app/data` | Persistent storage for cards, settings, and configuration |
| `/var/run/docker.sock` | Docker socket for container monitoring (optional, read-only) |

### Ports

| Port | Description |
|------|-------------|
| 3000 | HTTP |
| 3443 | HTTPS (self-signed certificate) |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TZ` | Timezone | `UTC` |

## Data Persistence

All configuration data is stored in the `/app/data` volume:

- `cards.json` - Service cards configuration
- `config.json` - Application settings
- `categories.json` - Custom categories
- `tasks.json` - Tasks and notes
- `providers.json` - Payment providers
- `payments.json` - Payment records

Data persists across container updates when the volume is mounted.

## Updating

### Docker Compose

```bash
docker compose pull
docker compose up -d
```

### Docker Run

```bash
docker stop homedash
docker rm homedash
docker pull ghcr.io/jvckdubz/homedash:latest
# Run the container again with the same parameters
```

## Building from Source

```bash
git clone https://github.com/jvckdubz/homedash.git
cd homedash
docker compose up -d --build
```

## License

MIT

## Links

- [GitHub Repository](https://github.com/jvckdubz/homedash)
- [Docker Image](https://ghcr.io/jvckdubz/homedash)
