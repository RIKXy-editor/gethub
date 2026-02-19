# Editors Club Discord Bot

## Project Overview

Private Discord bot for Editors Club server with a Ticket & Subscription SaaS system and web dashboard. Bot manages Discord slash commands, ticket flows, subscriptions, automated reminders, and provides a web-based admin dashboard with Discord OAuth2 authentication.

## Current Status

**Bot Running:**
- Discord Bot (`npm start`) - 27 commands, 7 events, executor pattern
- Web Dashboard on port 5000 with Discord OAuth2 login
- PostgreSQL database for all ticket/subscription data
- Automated reminder scheduler (node-cron, hourly checks)

## Architecture

**Discord Bot + Express Web Server**
- Discord.js v14 bot with slash commands
- Express 5 web server on port 5000
- PostgreSQL (Neon-backed) for persistent data
- JSON files for legacy features (giveaways, sticky, etc.)
- Discord OAuth2 for dashboard authentication

## Bot Features

### Commands (27 total)
- `/active` - Activity tracking
- `/announce` - Post announcements
- `/antiraid` - Anti-raid protection
- `/appeals` - Ban appeal system
- `/avatar` - Display user avatar/banner
- `/botset` - Change bot profile
- `/clear` - Delete messages
- `/copy` - Clone channel
- `/dm` - Send direct messages
- `/embade` - Build custom embeds
- `/feed` - Review/feedback requests
- `/gcreate` - Create giveaways
- `/gend` - End giveaways
- `/glist` - List giveaways
- `/greroll` - Reroll winners
- `/jobconfig` - Job posting config
- `/keyword` - Auto-warning keywords
- `/lockdown` - Lock/unlock channels
- `/messages` - Message stats
- `/schedule` - Schedule messages
- `/security` - Security settings
- `/serverstats` - Server statistics
- `/setjobbanner` - Job banner text
- `/sticky` - Sticky messages
- `/unsticky` - Remove sticky
- `/userinfo` - User information
- `/welcome` - Welcome system

### Ticket & Subscription System
1. **Ticket Panels** - Configurable panels with buttons in Discord channels
2. **Plan Selection** - Database-driven subscription plans (1/3/6/12 months)
3. **Payment Methods** - Configurable payment methods (UPI/PayPal/Crypto/Card)
4. **Payment Flow** - User selects plan → payment method → "I Have Paid" → admin confirms
5. **Email Collection** - Modal after payment confirmation to collect user email
6. **Subscription Creation** - Auto-creates subscription with start/end dates
7. **Automated Reminders** - node-cron hourly checks, DMs at 3/2/1 days before expiry
8. **10% Discount Offer** - Final day reminder includes discount incentive
9. **Resubscribe Link** - DB-configurable resubscribe channel per guild

### Other Features
1. **Welcomer** - Welcome new members with customizable embeds
2. **Announcements** - Post announcements to channels
3. **Job Posting** - Job listing management with sticky banner
4. **Giveaways** - Server giveaways with entry, winner selection, reroll
5. **Scheduled Messages** - Message scheduling system
6. **Sticky Messages** - Pinned messages system
7. **Ban Appeals** - Appeal system with DMs and staff review
8. **Moderation** - Clear, lockdown, channel copy, anti-raid
9. **Keyword Warnings** - Auto-detect and warn on keywords

## Web Dashboard

### Login
- Discord OAuth2 authentication (requires DISCORD_CLIENT_SECRET)
- Only server administrators can access

### Dashboard Sections
- **Overview** - Stats cards, recent activity
- **Panels** - CRUD for ticket panels
- **Plans** - CRUD for subscription plans
- **Payment Methods** - CRUD for payment methods
- **Subscriptions** - View/manage active subscriptions
- **Tickets** - View/manage tickets
- **Reminders** - View reminder history
- **Settings** - Guild configuration (staff roles, reminder days, resubscribe channel)
- **Logs** - Activity/audit logs

## Data Storage

### PostgreSQL (Primary - Ticket/Subscription System)
- `guilds` - Guild configuration (staff roles, reminder days, resubscribe channel)
- `ticket_panels` - Panel configurations
- `plans` - Subscription plans
- `payment_methods` - Payment method configs
- `users` - User records
- `tickets` - Ticket records with full state
- `subscriptions` - Active/expired subscriptions
- `reminders` - Scheduled reminder records
- `payments` - Payment records
- `logs` - Audit/activity logs
- `welcome_config` - Welcome system config
- `keyword_settings` / `keywords` - Keyword warning config

### JSON Files (`data/*.json`)
- `giveaways.json` - Giveaway data
- `scheduled-messages.json` - Scheduled messages
- `sticky-messages.json` - Sticky message data
- `job-config.json` - Job posting config
- `appeals-config.json` - Appeals configuration

## Key Files
- `index.js` - Bot entry point, DB init, interaction router, web server startup
- `src/db/schema.js` - PostgreSQL schema definition and seeding
- `src/db/models.js` - Database access layer (Guild, Panel, Plan, PaymentMethod, Ticket, Subscription, Reminder, etc.)
- `src/services/ticketService.js` - Discord ticket interaction handlers
- `src/services/reminderService.js` - Automated reminder scheduler
- `src/web/server.js` - Express web server setup
- `src/web/routes/api.js` - Dashboard REST API routes
- `src/web/routes/auth.js` - Discord OAuth2 authentication routes
- `src/web/public/dashboard.html` - Dashboard frontend
- `src/web/public/js/dashboard.js` - Dashboard frontend JavaScript
- `src/web/public/index.html` - Login page
- `src/utils/storage.js` - JSON file storage utilities
- `src/events/ready.js` - Bot startup, status rotation, schedulers

## Environment Variables
- `DISCORD_TOKEN` - Bot token (required)
- `DISCORD_CLIENT_ID` - Bot application ID (required)
- `DISCORD_GUILD_ID` - Server ID (required)
- `DISCORD_CLIENT_SECRET` - OAuth2 client secret (required for dashboard)
- `SESSION_SECRET` - Express session secret (required)
- `DATABASE_URL` - PostgreSQL URL (required)

## User Preferences
- **Control Style:** Discord slash commands + web dashboard for admin
- **Storage:** PostgreSQL for ticket/subscription data, JSON for legacy features
- **Design:** Dark theme, modern UI
- **Architecture:** All config database-driven, no hardcoded values

## Recent Changes (Feb 2026)
1. Built comprehensive Ticket & Subscription SaaS system
2. Added PostgreSQL schema with 10+ tables (including plan_pricing for per-method pricing)
3. Built Express web dashboard with Discord OAuth2
4. Implemented full ticket flow (plan → payment → confirm → email → subscription)
5. Added node-cron automated reminder system (3/2/1 days before expiry)
6. Dashboard with full CRUD for panels, plans, payment methods, subscriptions
7. Resubscribe channel is DB-configurable per guild (no hardcoded values)
8. Per-payment-method pricing: Different prices per plan for each payment method (e.g., UPI vs PayPal)
