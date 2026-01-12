# HomeDash

A modern, self-hosted dashboard for monitoring your home infrastructure. Track servers, services, payments, and tasks in one beautiful interface.

## Features

### Service Management
- **Card-based interface** - Organize services into customizable categories
- **Drag-and-drop** - Reorder cards within categories
- **Custom icons** - Choose from 60+ icons or auto-fetch favicons from URLs
- **Color themes** - 10 color options for visual organization

### Integrations
Real-time monitoring for popular self-hosted services:

| Integration | Metrics |
|-------------|---------|
| **Proxmox VE** | VMs, LXC containers, storage, CPU, RAM, uptime |
| **Docker** | Container status, running/stopped count, container list |
| **MikroTik** | RouterOS version, CPU, RAM, interfaces, uptime |
| **OpenWRT** | CPU, RAM, uptime, system info |
| **AdGuard Home** | Queries, blocked percentage, processing time |
| **Pi-hole** | Queries, blocked domains, gravity list size |
| **CrowdSec** | Blocked IPs, decision types, top scenarios |
| **Synology DSM** | CPU, RAM, volumes, uptime |
| **TrueNAS** | Pools, datasets, CPU, RAM |
| **Portainer** | Containers, stacks, endpoints |
| **QNAP** | CPU, RAM, volumes |
| **3X-UI / X-UI** | VPN panel metrics |
| **Outline VPN** | Server status |
| **WireGuard** | Peer connections |
| **SSH** | Custom command execution for any Linux server |

### Uptime Monitoring
- **HTTP/HTTPS checks** - Monitor any URL with configurable intervals
- **SSH checks** - Monitor servers via SSH connection
- **Response time tracking** - Historical response time graphs
- **Uptime statistics** - 24h, 7d, 30d availability percentages
- **Status history** - Visual timeline of up/down events

### Notifications

**Browser notifications:**
- Payment reminders (1, 3, 7, 14 days before due)
- Works when app is open or in background

**Telegram notifications:**
- Service down/up alerts
- Payment reminders
- Task deadline reminders  
- Daily summary (configurable time)
- **Topic support** - Send different notification types to different Telegram group topics

### Payment Tracking
- Track subscriptions and recurring payments
- Payment history with statistics
- Upcoming payments overview
- Provider management
- Currency support (RUB, USD, EUR, etc.)

### Tasks and Notes
- Task management with priorities and deadlines
- Color-coded notes
- Markdown support
- Quick access from dashboard

### Additional Features
- **PWA support** - Install as app on mobile/desktop
- **Dark theme** - Easy on the eyes
- **Responsive design** - Works on desktop, tablet, and mobile
- **Data export/import** - Backup and restore your configuration
- **Multi-language** - Russian and English
- **HTTPS support** - Bring your own SSL certificates
- **Auto-discovery** - Detect integration type from URL


## Installation

### Docker Compose (Recommended)

1. Create a directory for HomeDash:
```bash
mkdir homedash && cd homedash
```

2. Create `docker-compose.yml`:
```yaml
services:
  homedash:
    image: ghcr.io/username/homedash:latest
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

3. Start the container:
```bash
docker compose up -d
```

4. Open http://localhost:3000

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
  ghcr.io/username/homedash:latest
```

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/username/homedash.git
cd homedash
```

2. Build and run:
```bash
docker compose up -d --build
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP port |
| `HTTPS_PORT` | 3443 | HTTPS port |
| `TZ` | UTC | Timezone for notifications |
| `NODE_ENV` | production | Environment mode |

### Volumes

| Path | Description |
|------|-------------|
| `/app/data` | Persistent data (config, payments, tasks) |
| `/app/data/icons` | Custom uploaded icons |
| `/app/data/ssh_keys` | SSH private keys for integrations |
| `/app/data/ssl` | SSL certificates (server.key, server.crt) |

### HTTPS Setup

To enable HTTPS, place your SSL certificates in the data directory:

```bash
mkdir -p data/ssl
cp your-certificate.crt data/ssl/server.crt
cp your-private-key.key data/ssl/server.key
```

Restart the container and access via https://localhost:3443

### Docker Socket (Optional)

Mount the Docker socket to enable:
- Docker integration for monitoring containers
- In-app updates

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

## Telegram Setup

1. Create a bot via @BotFather
2. Get your Chat ID via @userinfobot or @getmyid_bot
3. Go to Settings -> Notifications -> Telegram
4. Enter Bot Token and Chat ID
5. Configure notification types and test

### Using Topics (Threads)

To send notifications to specific topics in a supergroup:

1. Create a supergroup and enable topics
2. Get the Topic ID from Telegram Web URL (number after last slash)
3. Enter Topic ID for each notification type

## API

HomeDash exposes a REST API for all operations:

```
GET  /api/config                      - Get configuration
PUT  /api/config                      - Update configuration  
GET  /api/integrations/:type/:cardId  - Get integration data
GET  /api/monitoring/status/:cardId   - Get monitoring status
GET  /api/monitoring/history/:cardId  - Get monitoring history
GET  /api/payments                    - Get payments data
POST /api/payments                    - Update payments
GET  /api/tasks                       - Get tasks data
POST /api/tasks                       - Update tasks
GET  /api/version                     - Get version info
```

## Development

### Prerequisites
- Node.js 20+
- npm

### Setup

```bash
# Clone repository
git clone https://github.com/username/homedash.git
cd homedash

# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies  
cd ../backend && npm install

# Start development servers (in separate terminals)
cd frontend && npm run dev    # Vite dev server on :5173
cd backend && npm run dev     # Backend on :3001
```

### Project Structure

```
homedash/
├── frontend/           # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx    # Main application
│   │   ├── index.css  # Styles
│   │   └── main.jsx   # Entry point
│   └── package.json
├── backend/            # Node.js backend (Express)
│   ├── server.js      # API server
│   ├── data/          # Data storage
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### Tech Stack

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- Framer Motion
- Lucide Icons
- dnd-kit (drag and drop)

**Backend:**
- Node.js 20
- Express
- SSH2 (SSH connections)
- Dockerode (Docker API)

## Updating

### Docker Compose
```bash
docker compose pull
docker compose up -d
```

### Docker Run
```bash
docker pull ghcr.io/username/homedash:latest
docker stop homedash
docker rm homedash
# Run docker run command again
```

## Troubleshooting

### Integration not working
1. Check that the service URL is accessible from the HomeDash container
2. Verify API credentials are correct
3. Check container logs: `docker logs homedash`

### Notifications not sending
1. Verify Telegram Bot Token and Chat ID
2. Test connection using the Test button in settings
3. For topics, ensure Topic ID is correct

### SSL/HTTPS issues
1. Ensure certificate files are named correctly (server.crt, server.key)
2. Check file permissions
3. Verify certificate is valid and not expired

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

This project was inspired by and incorporates ideas from:
- [Homer](https://github.com/bastienwirtz/homer)
- [Heimdall](https://github.com/linuxserver/Heimdall)  
- [Homarr](https://github.com/ajnart/homarr)
- [Uptime Kuma](https://github.com/louislam/uptime-kuma)
