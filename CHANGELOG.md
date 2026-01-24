# Changelog

## [1.1.4] - 2025-01-24

### Added
- "Sticker" style for custom icons - unified look with shadow and glassmorphism
- Custom icons now properly displayed in card detail view (was showing old icon)

### Fixed
- Custom icon not showing when opening card detail modal
- Icon containers now have consistent styling across all views

## [1.1.3] - 2025-01-24

### Added
- Font Awesome 6.5 integration (100+ icons)
- Icon picker with Lucide/Font Awesome tabs in payments
- Brand icons: Spotify, Netflix, YouTube, Telegram, Discord, Steam, etc.
- Category icons: utilities, transport, health, finance, etc.

### Changed
- Improved icon URL input styling (matches project design)

## [1.1.2] - 2025-01-23

### Added
- Custom icon URL field - use icons from any external source
- Links to popular icon sources (SimpleIcons, Dashboard Icons, Selfh.st)

### Changed
- Icon selection UI improved with URL input field
- "Fetch favicon" button only shows when no custom URL is set

## [1.1.1] - 2025-01-23

### Added
- Daily Telegram report with payments, tasks, services status, and update notifications
- Test button for daily report sends real data

### Fixed
- Docker image path in update commands (ghcr.io/jvckdubz/homedash)
- Version display after updates

## [1.1.0] - 2025-01-23

### Added
- Update checker with GitHub integration
- Automatic detection of deployment method
- Dynamic update commands based on deployment type
- Expanded icon library (30+ new icons)

### Fixed
- Note deletion modal now closes automatically
- Double confirmation dialogs on mobile card deletion

## [1.0.0] - Initial Release

### Features
- Service monitoring with health checks
- Docker and Portainer integration
- Payment and subscription tracking
- Task and note management
- Telegram notifications
- Multi-language support (RU/EN)
- PWA support
- Dark theme
