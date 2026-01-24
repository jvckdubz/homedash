# HomeDash

[English version](#english)

---

Дашборд для мониторинга сервисов и управления домашней инфраструктурой.

<details>
<summary>📸 Скриншоты</summary>

<img width="1912" height="906" alt="image" src="https://github.com/user-attachments/assets/3a4cd51e-7467-4479-9903-213165960a89" />
<img width="1903" height="713" alt="image" src="https://github.com/user-attachments/assets/f61dc81e-4df3-4dcc-8c88-5a9c71e29927" />
<img width="1903" height="759" alt="image" src="https://github.com/user-attachments/assets/de37d1de-79e8-4f02-8eca-ccb9c91022f4" />
<img width="1911" height="754" alt="image" src="https://github.com/user-attachments/assets/0908c8ac-97da-400a-bdab-3725b669c681" />








</details>

## Возможности

### 🖥 Карточки сервисов
- Организация сервисов по категориям
- Кастомные иконки (Lucide, Font Awesome, внешние URL)
- Цветовая маркировка
- Закладки — несколько ссылок в одной карточке

### 📡 Мониторинг
- HTTP/HTTPS проверки доступности
- Статистика uptime за 24 часа / 7 дней
- Время отклика
- Telegram-уведомления при падении/восстановлении сервисов

### 🔌 Интеграции

| Сервис | Данные |
|--------|--------|
| **Proxmox VE** | CPU, RAM, VM/LXC статусы, uptime |
| **Portainer** | Контейнеры, стеки, окружения |
| **Docker** | Статусы контейнеров |
| **Home Assistant** | Состояния сущностей, сенсоры |
| **AdGuard Home** | Статистика блокировок, запросы |
| **Nginx Proxy Manager** | Хосты, сертификаты |
| **CrowdSec** | Alerts, decisions, bouncers |
| **OpenWRT** | Сетевая статистика, клиенты |
| **Wiki.js** | Статистика страниц |
| **SSH** | Системная информация удалённых хостов |

### 💳 Платежи и подписки
- Отслеживание регулярных платежей
- Напоминания о приближающихся оплатах
- Привязка к карточкам сервисов
- QR-коды для быстрой оплаты
- История платежей

### ✅ Задачи и заметки
- Управление задачами с приоритетами
- Дедлайны и напоминания
- Цветные заметки

### 🌤 Погода
- Виджет текущей погоды
- Интеграция с OpenWeatherMap или wttr.in

### 📱 Telegram
- Уведомления о статусе сервисов
- Ежедневные отчёты (платежи, задачи, статус сервисов)
- Поддержка топиков в группах

### ⚙️ Дополнительно
- Автоматические уведомления об обновлениях
- Мультиязычность (Русский / English)
- Адаптивный мобильный интерфейс
- PWA — установка как приложение
- Тёмная тема
- Экспорт/импорт данных

## Установка

### Docker Compose (рекомендуется)

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

Откройте `http://localhost:3000`

## Конфигурация

### Тома

| Путь | Описание |
|------|----------|
| `/app/data` | Данные приложения |
| `/var/run/docker.sock` | Docker socket (опционально) |

### Порты

| Порт | Описание |
|------|----------|
| 3000 | HTTP |
| 3443 | HTTPS (self-signed) |

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `TZ` | Часовой пояс | `UTC` |

## Обновление

```bash
docker compose pull
docker compose up -d
```

---

# English

Self-hosted dashboard for monitoring services and managing home infrastructure.

<details>
<summary>📸 Screenshots</summary>

![Dashboard](screenshots/dashboard.png)
![Mobile](screenshots/mobile.png)
![Payments](screenshots/payments.png)

</details>

## Features

### 🖥 Service Cards
- Organize services by categories
- Custom icons (Lucide, Font Awesome, external URLs)
- Color coding
- Bookmarks — multiple links in one card

### 📡 Monitoring
- HTTP/HTTPS availability checks
- Uptime statistics for 24h / 7 days
- Response time tracking
- Telegram notifications on status changes

### 🔌 Integrations

| Service | Data |
|---------|------|
| **Proxmox VE** | CPU, RAM, VM/LXC status, uptime |
| **Portainer** | Containers, stacks, environments |
| **Docker** | Container statuses |
| **Home Assistant** | Entity states, sensors |
| **AdGuard Home** | Blocking statistics, queries |
| **Nginx Proxy Manager** | Hosts, certificates |
| **CrowdSec** | Alerts, decisions, bouncers |
| **OpenWRT** | Network stats, clients |
| **Wiki.js** | Page statistics |
| **SSH** | Remote host system info |

### 💳 Payments & Subscriptions
- Track recurring payments
- Due date reminders
- Link to service cards
- QR codes for quick payment
- Payment history

### ✅ Tasks & Notes
- Task management with priorities
- Deadlines and reminders
- Color-coded notes

### 🌤 Weather
- Current weather widget
- OpenWeatherMap or wttr.in integration

### 📱 Telegram
- Service status notifications
- Daily reports (payments, tasks, service status)
- Group topics support

### ⚙️ Additional
- Automatic update notifications
- Multi-language (Russian / English)
- Responsive mobile interface
- PWA support
- Dark theme
- Export/import data

## Installation

### Docker Compose (recommended)

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

Open `http://localhost:3000`

## Configuration

### Volumes

| Path | Description |
|------|-------------|
| `/app/data` | Application data |
| `/var/run/docker.sock` | Docker socket (optional) |

### Ports

| Port | Description |
|------|-------------|
| 3000 | HTTP |
| 3443 | HTTPS (self-signed) |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TZ` | Timezone | `UTC` |

## Updating

```bash
docker compose pull
docker compose up -d
```

HomeDash automatically checks for updates and shows a notification in settings.

---

## License

MIT

## Links

- [GitHub](https://github.com/jvckdubz/homedash)
- [Docker Image](https://ghcr.io/jvckdubz/homedash)
