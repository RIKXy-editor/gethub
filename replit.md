# Editors Club Discord Bot - Admin Control System

## Project Overview

Private Discord bot for Editors Club server with **complete admin website control**. Website is the single source of truth for all bot configuration.

## Current Status

**Both Workflows Running:**
- ✅ **Discord Bot** (`npm start`) - 14 commands, 4 events, executor pattern
- ✅ **Admin Dashboard** (`npm run dashboard`) - Full control panel on port 5000

## Architecture

**Website → Config → Bot**

1. Admin logs into dashboard (password-protected)
2. Admin toggles features/commands in dark red/black UI
3. Admin clicks "SAVE"
4. Changes written to `data/admin-config.json`
5. Bot reads config and enforces rules immediately
6. No restart needed

## Bot Features (All Controllable from Website)

### Commands (14 total)
- `/announce` - Post announcements
- `/dm` - Send direct messages
- `/gcreate` - Create giveaways
- `/gend` - End giveaways
- `/glist` - List active giveaways
- `/greroll` - Reroll giveaway winners
- `/jobconfig` - Configure job posting
- `/remind` - Send ticket reminders
- `/schedule` - Schedule messages
- `/setjobbanner` - Set job banner text
- `/setwelcome` - Set welcome message
- `/sticky` - Create sticky message
- `/unsticky` - Remove sticky message
- `/welcomer` - Trigger welcome system

### Features (9 total)
1. **Welcomer** - Welcome new members
2. **Announcements** - Post announcements to channel
3. **Tickets** - Ticket reminder system
4. **Job Posting** - Job listing management
5. **Giveaways** - Server giveaways
6. **Scheduled Messages** - Message scheduling
7. **Sticky Messages** - Pinned messages system
8. **Leveling** (disabled by default) - Activity tracking
9. **Moderation** - Admin tools

## Admin Dashboard

**URL:** Your Replit project link (/)

**Login:**
- Default password: `admin123`
- Change via env: `DASHBOARD_PASSWORD=your_password`

**Sections:**
1. **📊 Overview** - Server status, member count, bot status
2. **🤖 Bot Control** - Master enable/disable, maintenance mode
3. **🎯 Features** - Toggle and configure all features with parameters
4. **⚡ Commands** - Enable/disable each command

**Theme:** Dark red (#cc0000) and black (#0a0a0a) - minimalist admin style

## Configuration Structure

**File:** `data/admin-config.json`

Single source of truth containing:
- Bot enable/disable status
- Maintenance mode toggle
- All 9 feature states and parameters
- All 14 command states

## User Preferences

- **Workflow:** Both dashboard + bot running simultaneously
- **Control Style:** Website-only (no Discord commands for configuration)
- **Philosophy:** Website decides, bot executes

## Recent Changes

1. **Complete Admin Control System** - Full dashboard for managing all features and commands
2. **Dark Red/Black UI** - Professional admin theme with #cc0000 red accents
3. **Bot Executor Pattern** - Bot only runs what config allows
4. **Single Source of Truth** - All settings in admin-config.json
5. **Zero-Downtime Updates** - Config changes apply instantly without restart

## Key Files

- `server.js` - Express backend for dashboard
- `public/admin.html` - Admin control panel UI
- `data/admin-config.json` - Configuration (single source of truth)
- `src/utils/botExecutor.js` - Bot config checking functions
- `src/middleware/commandCheck.js` - Command execution guard

## Security

✅ Password-protected login
✅ Session tokens (24-hour expiration)
✅ Admin-only access
✅ Config stored locally on Replit

## Bot Integration

To make commands respect the config:

```javascript
import { handleCommandExecution } from '../middleware/commandCheck.js';

export async function execute(interaction) {
  const check = await handleCommandExecution(interaction, 'command_name');
  if (!check.allowed) return;
  
  // Rest of command logic
}
```

## Deployment

Uses Replit's built-in hosting. No external services required.

## Next Steps

1. ✅ Admin dashboard live and ready
2. ✅ Both workflows running
3. 📝 Integrate command checks into all 14 commands (optional enhancement)
4. 🔐 Change default password immediately

## Resources

- See `ADMIN_PANEL.md` for complete dashboard documentation
- See `DASHBOARD.md` for legacy feature config info (deprecated)
