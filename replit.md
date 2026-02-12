# Editors Club Discord Bot

## Project Overview

Private Discord bot for Editors Club server. Pure Discord bot with no web dashboard - all configuration is done via Discord slash commands.

## Current Status

**Bot Running:**
- Discord Bot (`npm start`) - 27 commands, 7 events, executor pattern

## Architecture

**Discord-Only Bot (No Web Server)**

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

### Features
1. **Welcomer** - Welcome new members with customizable embeds
2. **Announcements** - Post announcements to channels
3. **Job Posting** - Job listing management with sticky banner
4. **Giveaways** - Server giveaways with entry, winner selection, reroll
5. **Scheduled Messages** - Message scheduling system
6. **Sticky Messages** - Pinned messages system
7. **Ban Appeals** - Appeal system with DMs and staff review
8. **Moderation** - Clear, lockdown, channel copy, anti-raid
9. **Keyword Warnings** - Auto-detect and warn on keywords

## Data Storage

### JSON Files (`data/*.json`)
- `giveaways.json` - Giveaway data
- `scheduled-messages.json` - Scheduled messages
- `sticky-messages.json` - Sticky message data
- `job-config.json` - Job posting config
- `appeals-config.json` - Appeals configuration
- Other config files

## User Preferences
- **Control Style:** Discord slash commands only (no web dashboard)
- **Storage:** JSON for config data

## Key Files
- `index.js` - Bot entry point, interaction router
- `src/utils/storage.js` - JSON file storage utilities
- `src/events/ready.js` - Bot startup, status rotation, schedulers

## Environment Variables
- `DISCORD_TOKEN` - Bot token (required)
- `DISCORD_CLIENT_ID` - Bot application ID (required)
- `DISCORD_GUILD_ID` - Server ID (required)
- `DATABASE_URL` - PostgreSQL URL (optional, for welcome/keywords)

## Recent Changes (Feb 2026)
1. Removed entire ticket system (ticket command, remind command, subscription reminders, email modal, SQLite database, panel restore)
2. Removed better-sqlite3 dependency
3. Bot now has 27 commands (removed ticket and remind)
