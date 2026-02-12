# Editors Club Discord Bot

## Project Overview

Private Discord bot for Editors Club server. Pure Discord bot with no web dashboard - all configuration is done via Discord slash commands.

## Current Status

**Bot Running:**
- Discord Bot (`npm start`) - 29 commands, 7 events, executor pattern
- SQLite persistent storage for ticket panels and subscriptions
- Automated subscription reminder system

## Architecture

**Discord-Only Bot (No Web Server)**

1. Admin uses `/ticket setup` to configure the ticket system
2. Admin uses `/ticket panel` to post ticket panels
3. Panel settings are persisted in SQLite (survives redeploy)
4. Subscription data stored in SQLite with automated reminders

## Bot Features

### Commands (29 total)
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
- `/remind` - Ticket reminders
- `/schedule` - Schedule messages
- `/security` - Security settings
- `/serverstats` - Server statistics
- `/setjobbanner` - Job banner text
- `/sticky` - Sticky messages
- `/ticket` - Ticket system (setup/panel/stats)
- `/unsticky` - Remove sticky
- `/userinfo` - User information
- `/welcome` - Welcome system

### Features
1. **Ticket System** - Full subscription ticket flow with payment, email submission via modal, plan selection
2. **Subscription Reminders** - Automated DMs 3 days before subscription expiry with 10% OFF on final day
3. **Welcomer** - Welcome new members with customizable embeds
4. **Announcements** - Post announcements to channels
5. **Job Posting** - Job listing management with sticky banner
6. **Giveaways** - Server giveaways with entry, winner selection, reroll
7. **Scheduled Messages** - Message scheduling system
8. **Sticky Messages** - Pinned messages system
9. **Ban Appeals** - Appeal system with DMs and staff review
10. **Moderation** - Clear, lockdown, channel copy, anti-raid
11. **Keyword Warnings** - Auto-detect and warn on keywords

## Data Storage

### SQLite Database (`data/bot.db`)
- `ticket_panels` - Panel configuration persisted across redeploys
- `subscriptions` - User subscription records (plan, email, dates)
- `subscription_reminders` - Scheduled reminder dates for each subscription
- `email_submissions` - Email records linked to tickets

### JSON Files (`data/*.json`)
- `ticketConfig.json` - Ticket system configuration
- `tickets.json` - Active ticket data
- `giveaways.json` - Giveaway data
- `scheduled-messages.json` - Scheduled messages
- `sticky-messages.json` - Sticky message data
- `job-config.json` - Job posting config
- `appeals-config.json` - Appeals configuration
- Other config files

## Ticket Flow
1. User clicks "Open Ticket" button on panel
2. Selects subscription plan (1 Month, 3 Months, 6 Months, 1 Year)
3. Selects payment method (UPI, Card, PayPal, Crypto)
4. Clicks "I have Paid" button
5. "Payment Confirmed" embed appears with green "Submit Email" button
6. User clicks "Submit Email" → Discord modal opens
7. User enters email carefully (warning about wrong email)
8. Subscription created in SQLite with:
   - User ID, email, plan, start/end dates
   - 3 reminder dates created (3, 2, 1 days before expiry)
9. Staff can claim, close, transcript, rate tickets

## Subscription Reminder System
- Checks every hour for pending reminders
- Sends DM embed: "Subscription Ending Soon" with details
- Green "Resubscribe Now" button linking to ticket channel
- Final day reminder includes: "Get 10% OFF on any subscription from 3 months to 1 year"
- Auto-expires subscriptions past end date
- Survives bot redeploy (stored in SQLite)

## User Preferences
- **Control Style:** Discord slash commands only (no web dashboard)
- **Storage:** SQLite for persistent data, JSON for legacy config

## Key Files
- `index.js` - Bot entry point, interaction router
- `src/commands/ticket.js` - Full ticket system with email modal
- `src/utils/database.js` - SQLite database schema and helpers
- `src/utils/reminderScheduler.js` - Subscription reminder scheduler
- `src/utils/panelRestore.js` - Panel restoration on startup
- `src/utils/storage.js` - JSON file storage utilities
- `src/events/ready.js` - Bot startup, status rotation, schedulers

## Environment Variables
- `DISCORD_TOKEN` - Bot token (required)
- `DISCORD_CLIENT_ID` - Bot application ID (required)
- `DISCORD_GUILD_ID` - Server ID (required)
- `DATABASE_URL` - PostgreSQL URL (optional, for welcome/keywords)

## Recent Changes (Feb 2026)
1. Removed entire web dashboard (Express, Next.js, admin routes)
2. Added SQLite persistent storage for ticket panels and subscriptions
3. Added email submission via Discord modal (not chat input)
4. Added subscription reminder system with automated DMs
5. Cleaned unused dependencies (express, cors, next, express-session)
