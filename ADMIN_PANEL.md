# 🔴 ADMIN CONTROL PANEL

Complete admin website for full Discord bot control. **Website is the single source of truth.**

## Features

### 🎛️ Bot Control
- **Master Enable/Disable** - Turn bot on/off completely
- **Maintenance Mode** - Disable all commands except admin
- **Live Server Info** - View member count and bot status

### 🎯 Feature Management
- **Toggle All Features** - Enable/disable each system independently
- **Configure Parameters** - Adjust feature settings (channels, intervals, limits)

**Manageable Features:**
- Welcome Messages (with channel configuration)
- Announcements (with channel configuration)
- Ticket Reminders (with interval setting)
- Job Posting System (with channel configuration)
- Giveaways (with max duration)
- Scheduled Messages (with max scheduled limit)
- Sticky Messages (with max sticky limit)
- Leveling System (with XP per message)
- Moderation Tools

### ⚡ Command Control
- **Enable/Disable Commands** - Toggle all 14 slash commands
- **Instant Activation** - No bot restart needed

**Manageable Commands:**
- /announce
- /dm
- /gcreate
- /gend
- /glist
- /greroll
- /jobconfig
- /remind
- /schedule
- /setjobbanner
- /setwelcome
- /sticky
- /unsticky
- /welcomer

## Architecture

```
Admin Dashboard (Dark Red/Black UI)
        ↓
Express Backend API
        ↓
admin-config.json (Single Source of Truth)
        ↓
Discord Bot (Executor Only)
```

**Critical Rule:** Bot does NOTHING unless config allows it.

## Access

**URL:** Your Replit project link (/)

**Default Password:** `admin123`

**Change immediately:**
```bash
# Set in Replit Secrets
DASHBOARD_PASSWORD=your_secure_password_here
```

## Admin Panel Layout

Dark red (#cc0000) and black (#0a0a0a) minimalist design:

1. **📊 Overview** - Server status, master controls
2. **🤖 Bot Control** - Bot enable/disable, maintenance mode
3. **🎯 Features** - Toggle and configure all features
4. **⚡ Commands** - Enable/disable each slash command

## Configuration File

All settings stored in `data/admin-config.json`:

```json
{
  "bot": {
    "enabled": true,
    "maintenance_mode": false
  },
  "features": {
    "feature_name": {
      "enabled": true,
      "param1": "value1"
    }
  },
  "commands": {
    "command_name": { "enabled": true }
  }
}
```

## API Endpoints

- `POST /api/login` - Authenticate with password
- `GET /api/admin/config` - Get current configuration
- `POST /api/admin/config` - Update configuration
- `POST /api/logout` - Logout

All endpoints require `x-session-token` header.

## Bot Integration

### Check if Command Allowed
```javascript
import { handleCommandExecution } from '../middleware/commandCheck.js';

export async function execute(interaction) {
  const check = await handleCommandExecution(interaction, 'command_name');
  if (!check.allowed) return;
  
  // Rest of command logic
}
```

### Check Feature Status
```javascript
import { isFeatureEnabled, getFeatureConfig } from '../utils/botExecutor.js';

if (!isFeatureEnabled('feature_name')) {
  return interaction.reply('Feature disabled');
}

const config = getFeatureConfig('feature_name');
// Use config values
```

## Security

### Authentication
- Password-protected login
- Session tokens (24-hour expiration)
- Admin-only access

### Best Practices
1. Change default password immediately
2. Store password in environment variables
3. Only admin should have access
4. Log admin actions (optional enhancement)

## Workflows

**Dashboard:** `npm run dashboard` (port 5000, webview)
**Discord Bot:** `npm start` (console)

## File Structure

```
├── server.js                          # Express backend
├── public/
│   ├── index.html                    # Login page
│   └── admin.html                    # Admin dashboard UI
├── data/
│   └── admin-config.json             # Configuration source of truth
├── src/
│   ├── utils/botExecutor.js          # Config checking functions
│   └── middleware/commandCheck.js    # Command execution guard
└── ADMIN_PANEL.md                    # This file
```

## Workflow

1. Admin logs into dashboard
2. Admin toggles features/commands in UI
3. Admin clicks "SAVE"
4. Changes written to `admin-config.json`
5. Bot reads config and enforces rules
6. Commands/features are enabled/disabled immediately
7. No restart needed

## What Makes This Enterprise-Grade

✅ Single source of truth (config file)
✅ Website is only control interface
✅ Bot is executor, not decision-maker
✅ Zero downtime configuration changes
✅ No feature creep
✅ Clean separation of concerns
✅ Scalable architecture

## What This NOT

❌ Real-time moderation (ban/kick/mute)
❌ Analytics or logging
❌ User management
❌ Database queries from UI
❌ New feature invention

This is **control only**. Execution stays in Discord.
