# Editors Club Discord Bot - Admin Control System

## Project Overview

Private Discord bot for Editors Club server with **complete admin website control**. Website is the single source of truth for all bot configuration.

## Current Status

**Both Workflows Running:**
- ✅ **Discord Bot** (`npm start`) - 14 commands, 4 events, executor pattern
- ✅ **Admin Dashboard** (`npm run dashboard`) - Full control panel on port 5000

## Architecture

**Dual System:**
- **Admin Dashboard** — Website-based control panel for settings, panels, giveaways, etc.
- **Database-driven Tickets** — PostgreSQL stores ticket panels, plans, payment methods, tickets, subscriptions, payments

**Ticket Flow (DB-driven):**
1. Admin posts panel via `/ticket panel #channel` or dashboard
2. User clicks "Open Ticket" → ticket channel created
3. User selects plan → payment method → per-method pricing shown
4. User clicks "I've Paid" → staff confirms/denies
5. On confirm → user enters email → subscription created automatically

**Legacy Config:** `data/admin-config.json` still used for features like welcomer, giveaways, announcements, keywords

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

**URL:** Your Replit project link (/admin)

**Login:**
- Set via environment variable: `ADMIN_PASSWORD=your_password`

**Sections:**
1. **📊 Dashboard** - Overview of bot status and statistics
2. **🎫 Tickets** - View and manage all tickets
3. **📋 Panels** - Create and configure ticket panels
4. **🎨 Embed Builder** - Build custom embeds with live preview, save templates, send to channels
5. **👋 Welcome** - Configure welcome messages, channel, auto-role, DM options
6. **🔑 Keywords** - Manage auto-warning keyword system
7. **🎁 Giveaways** - View/end/delete giveaways with full winner selection
8. **⚙️ Settings** - Bot configuration and payment methods
9. **📈 Staff Stats** - View staff performance metrics

**Theme:** Dark modern design with purple accents

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

- `index.js` - Main bot entry point, interaction routing
- `src/commands/ticket.js` - `/ticket setup` and `/ticket panel` slash commands (DB-driven)
- `src/db/models.js` - Database model wrappers (Guild, Panel, Plan, PaymentMethod, Ticket, Subscription, Payment, PlanPricing)
- `src/services/ticketService.js` - All ticket button interaction handlers (open, plan, pay, confirm, close, claim, email)
- `src/admin/routes.js` - Express API routes for dashboard
- `data/admin-config.json` - Legacy config for non-ticket features
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
