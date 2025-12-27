# Control Panel Dashboard

Minimal admin control panel for managing Discord bot features.

## Features

The dashboard allows you to:
- ✅ Toggle bot features ON/OFF
- ✅ View all available features
- ✅ Save changes in real-time
- ✅ Password-protected access

## Supported Features

- **Welcomer** - Welcome messages for new members
- **Announcements** - Post announcements to channels
- **Tickets** - Ticket reminder system
- **Job Posting** - Job listing system
- **Giveaways** - Server giveaways
- **Scheduled Messages** - Schedule messages in advance
- **Sticky Messages** - Keep important messages pinned
- **Leveling** - User activity tracking
- **Moderation** - Server moderation tools

## Setup

### Environment Variable

Set your admin password:
```bash
DASHBOARD_PASSWORD=your_secure_password_here
```

Default password: `admin123` (change this immediately!)

### Access the Dashboard

1. Start the dashboard: `npm run dashboard`
2. Visit: `http://localhost:5000`
3. Login with your admin password
4. Toggle features ON/OFF
5. Click "Save Changes"

## How It Works

1. **Configuration File**: `data/feature-config.json` stores all feature states
2. **Express API**: `/api/config` endpoint provides feature data
3. **HTML UI**: Simple web interface for toggling features
4. **Bot Integration**: Bot reads config on startup and before each command

## Bot Integration

To make a command respect the feature config:

```javascript
import { isFeatureEnabled } from '../utils/configLoader.js';

export async function execute(interaction) {
  if (!isFeatureEnabled('feature_name')) {
    return interaction.reply({
      content: 'This feature is currently disabled.',
      ephemeral: true
    });
  }
  
  // Rest of command logic
}
```

## Security Notes

- Change the default password immediately
- Store password in environment variables
- Sessions auto-expire after 24 hours
- Only the bot owner should have access

## API Endpoints

- `POST /api/login` - Login with password
- `GET /api/config` - Get current feature config (requires auth)
- `POST /api/config` - Update feature config (requires auth)
- `POST /api/logout` - Logout and invalidate session

## File Structure

```
├── server.js                 # Express dashboard backend
├── public/
│   └── index.html           # Dashboard UI
├── data/
│   └── feature-config.json  # Feature states
├── src/
│   └── utils/
│       └── configLoader.js  # Config utility functions
└── package.json             # Dependencies (includes express)
```
