# Discord Ticket Reminder Bot

## Overview
A powerful Discord bot that helps moderators and server administrators manage tickets, announcements, welcome messages, and scheduled communications. The bot uses Discord's slash commands and provides comprehensive server management features.

**Current Status:** Active and running
**Last Updated:** November 29, 2025

## Features

### Core Features
- `/remind` - Send ticket reminder DMs to users with embedded messages
- `/announce` - Send plain text or embedded announcements to any channel
- `/welcomer` - Auto-send welcome messages to new members + optional role assignment
- `/sticky` - Create sticky messages that repost when users chat
- `/schedule` - Schedule messages to send at specific times with repetition options (daily/weekly/monthly)
- `/dm` - Send DMs to all members with a specific role (admin only)

### System Features
- Rotating status messages showing editing-related activities (changes every 15 seconds)
- **Private bot security** - Only works in the authorized server, blocks all other servers and DMs
- Modular architecture with commands, events, and utilities
- Persistent data storage using JSON files

## Project Structure
```
.
├── index.js                 # Main bot file with command & event loader
├── package.json            # Node.js dependencies
├── .gitignore             # Git ignore patterns
├── replit.md              # This file
└── src/
    ├── commands/          # Slash command modules
    │   ├── announce.js    # Announcement command
    │   ├── dm.js          # Bulk DM to role command
    │   ├── remind.js      # Ticket reminder command
    │   ├── welcomer.js    # Welcomer setup command
    │   ├── sticky.js      # Sticky message command
    │   └── schedule.js    # Message scheduling command
    ├── events/            # Discord event handlers
    │   ├── guildMemberAdd.js  # Welcome new members
    │   ├── messageCreate.js   # Handle sticky messages
    │   └── ready.js           # Bot startup & status rotation
    └── utils/             # Utility functions
        ├── storage.js     # Data persistence (JSON files)
        └── constants.js   # Shared constants & colors
└── data/                  # Data storage directory
    ├── configs.json           # Guild configurations
    ├── scheduled-messages.json # Scheduled messages
    └── sticky-messages.json   # Sticky message data
```

## How to Use

### The /remind Command
Send ticket reminders to users via DM:
```
/remind user:@username ticket:"Ticket #123" message:"Please update your ticket"
```
- `user` - Target Discord user
- `ticket` - Ticket number/description
- `message` - Optional custom message

### The /announce Command
Send announcements to a channel:
```
/announce channel:#announcements message:"Important update!"
```
- `channel` - Target channel
- `message` - Announcement text
- `with-embed` - Send as embedded message (optional)

### The /welcomer Command
Set up automatic welcome messages:
```
/welcomer setup channel:#welcome message:"Welcome to the server!" role:@NewMember
```
Subcommands:
- `setup` - Configure welcome message, channel, and optional role assignment
- `disable` - Turn off welcomer

### The /sticky Command
Create messages that repost when chatted in:
```
/sticky create channel:#rules message:"Please read the rules"
```
Subcommands:
- `create` - Create a sticky message in a channel
- `remove` - Remove sticky message from a channel

### The /schedule Command
Schedule messages to send automatically:
```
/schedule add channel:#announcements message:"Daily reminder!" time:"09:00" frequency:"daily"
```
Subcommands:
- `add` - Schedule a new message (time in HH:MM format)
- `list` - View all scheduled messages
- `remove` - Delete a scheduled message

Frequency options: once, daily, weekly, monthly

### The /dm Command
Send DMs to all members with a specific role (Admin only):
```
/dm role:@RoleName message:"Your message here"
```
- `role` - Target role to send DMs to
- `message` - Message to send (plain text)

Features:
- Automatically skips bots
- Rate-limited to avoid crashing with large member counts
- Skips members with DMs disabled and logs them
- Shows summary with success/fail counts
- Admin permission required

## Setup Information

### Required Secrets
Configure these environment variables:
- `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` - Application client ID
- `DISCORD_GUILD_ID` - Your Discord server ID

### Bot Permissions Required
Ensure your bot has these Discord permissions:
- Send Messages
- Embed Links
- Manage Roles (for welcomer role assignment)
- Manage Messages (for sticky message deletion)
- Use Slash Commands

### Invite Link
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877975552&scope=bot%20applications.commands
```
Replace `YOUR_CLIENT_ID` with your actual Discord Client ID.

## Technical Details

### Dependencies
- **discord.js v14.14.1** - Discord API wrapper
- **Node.js 20** - JavaScript runtime

### Architecture
- **Modular Design** - Commands and events are separate, importable modules
- **Event-Driven** - Discord events (ready, guildMemberAdd, messageCreate) trigger appropriate handlers
- **Persistent Storage** - JSON-based data storage for configurations and scheduled items
- **Clean Separation** - Commands handle slash interactions, events handle Discord events

### Data Persistence
- **configs.json** - Guild-specific settings (welcomer config, etc.)
- **scheduled-messages.json** - All scheduled messages with timing and repetition
- **sticky-messages.json** - Active sticky messages per channel

### Rotating Status
The bot displays different editing-related activities that rotate every 15 seconds:
- Managing Editors Club
- Editing Videos
- Searching Assets
- Rendering Projects
- Color Grading
- Audio Mixing
- Exporting Videos
- Managing Tickets

### Security Features
- **Guild Verification** - Commands only work in authorized server
- **DM Protection** - Commands sent via DM are rejected
- **Unauthorized Access Logging** - All unauthorized attempts logged
- **Private Bot** - Only your server can use it

### Error Handling
- DM failures handled gracefully with error messages
- All responses are ephemeral (only visible to command user)
- Missing channels/roles won't crash the bot
- Scheduled message failures logged without stopping the bot

## Recent Changes
- **November 29, 2025** - Added bulk DM feature to send messages to all members with a specific role
- **November 29, 2025** - Added 5 major features: announcements, welcomer, sticky messages, scheduled messages, and modular architecture
- **October 30, 2025** - Removed AI assistant feature per user request
- **October 30, 2025** - Added private bot security with guild verification and DM blocking
- **October 30, 2025** - Added rotating status feature with editing-related activities
- **October 30, 2025** - Initial bot creation with `/remind` command

## User Preferences
- Uses embedded messages for better visual presentation
- Commands are ephemeral to keep server channels clean
- Simple, straightforward interface for ease of use
- Modular, scalable design for future feature additions
