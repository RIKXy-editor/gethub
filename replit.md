# Discord Ticket Reminder Bot

## Overview
A powerful Discord bot that helps moderators and server administrators manage tickets, announcements, welcome messages, and scheduled communications. The bot uses Discord's slash commands and provides comprehensive server management features.

**Current Status:** Active and running
**Last Updated:** November 29, 2025

## Features

### Core Features
- `/remind` - Send ticket reminder DMs to users with embedded messages
- `/announce` - Send announcements with multi-line message collection
- `/welcomer` - Auto-send welcome messages to new members + optional role assignment
- `/sticky` - Create/update sticky messages (one per channel, auto-reposts at bottom)
- `/unsticky` - Remove sticky message from channel
- `/schedule` - Schedule messages (once, 12h, daily, weekly, monthly) with message collection
- `/dm` - Send DMs to all members with a specific role (admin only)
- `/jobconfig` - Configure job posting system (admin only)

### Job Posting System
**Setup:**
```
/jobconfig channel:#jobs role:@Poster cooldown:5
```
- `channel` - Where job posts appear
- `role` - (Optional) Restrict posting to users with this role
- `cooldown` - Minutes between posts per user (1-60, default 5)

**Flow:**
1. Bot maintains a banner message with rules + "Post Job" button at the bottom
2. User clicks button → modal form opens with 5 fields
3. User submits → job posts to channel (new separate message)
4. Job post gets ✔️ and ❌ reactions automatically
5. Thread created under job post (if supported)
6. Banner+button MOVES to bottom (old banner deleted, new one posted below the job)
7. User gets ephemeral confirmation with job link

**Banner Message:**
```
📋 Post Your Job Here

Rules for posting jobs:
- Be clear about what you want (no vague "need editor" only).
- Mention video type (YouTube, Reels, Shorts, Ads, etc.).
- Mention contract type (one-time / monthly / long-term).
- Mention budget honestly (fixed / range / negotiable).
- Add sample links (YouTube / Google Drive) so editors can see your style.
- No fake jobs, no trolling, no spam.

[Post Job button]
```

**Modal Fields:**
- "Want" (paragraph, required) - Job description
- "Video Type" (short, required) - YouTube/Reels/Shorts/Ads etc
- "Contract" (short, required) - One-time/Monthly/Long-term
- "Budget" (short, required) - e.g. 3000 INR/video, $50/video, Negotiable
- "Samples" (paragraph, optional) - YouTube/Google Drive links

**Job Post Template:**
```
Want: <description>

Video Type: <type>

Contract: <contract>

Budget: <budget>

Samples: <links or "Not provided">

DM @user for work with them.
```

**Banner Behavior:**
- ✅ Always the last message in the channel
- ✅ Automatically repositioned after each job post
- ✅ Recreated if deleted
- ✅ Only one banner exists at a time

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
    │   ├── announce.js    # Announcement command (message collection)
    │   ├── dm.js          # Bulk DM to role command
    │   ├── remind.js      # Ticket reminder command
    │   ├── welcomer.js    # Welcomer setup command
    │   ├── sticky.js      # Sticky message command (message collection)
    │   ├── unsticky.js    # Remove sticky message command
    │   └── schedule.js    # Message scheduling command (message collection)
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
Send announcements to a channel with multi-line support:
```
/announce channel:#announcements
```
**Flow:**
1. Run the command with just the target channel
2. Bot asks: "What is the announcement message content? Type 'cancel' to stop."
3. Type your announcement (can be multi-line, with links, formatting, etc.)
4. Bot sends it exactly as you wrote it to the target channel

- `channel` - Target channel for the announcement
- Type 'cancel' to abort

### The /welcomer Command
Set up automatic welcome messages:
```
/welcomer setup channel:#welcome message:"Welcome to the server!" role:@NewMember
```
Subcommands:
- `setup` - Configure welcome message, channel, and optional role assignment
- `disable` - Turn off welcomer

### The /sticky Command
Create or update a sticky message that reposts at the bottom when users chat:
```
/sticky
```
**Flow:**
1. Run `/sticky` in the target channel
2. Bot asks: "What is the sticky message content? Type 'cancel' to stop."
3. Type your sticky message (multi-line, formatting preserved)
4. Bot posts it and keeps it at the bottom of the channel

**Features:**
- Only ONE sticky per channel (replaces existing if you run again)
- Auto-reposts whenever someone sends a message
- Ignores bot messages (prevents infinite loops)
- Multi-line and formatting preserved

### The /unsticky Command
Remove the sticky message from a channel:
```
/unsticky
```
- Deletes the current sticky message in that channel
- Can only be run in the channel with an active sticky

### The /schedule Command
Schedule messages to send automatically with multi-line support:

**Add a scheduled message:**
```
/schedule add channel:#announcements time:"09:00" frequency:"daily"
```
**Flow:**
1. Run the command with channel, time, and frequency
2. Bot asks: "What is the message's content? Type 'cancel' to stop."
3. Type your message (can be multi-line, with links, formatting, etc.)
4. Bot schedules it exactly as you wrote it

**Manage scheduled messages:**
- `/schedule list` - View all scheduled messages
- `/schedule remove id:12345` - Delete a scheduled message

Parameters:
- `channel` - Channel to send scheduled message to
- `time` - Time in HH:MM format (24-hour)
- `frequency` - Repetition: once, every 12 hours, daily, weekly, monthly
- Type 'cancel' to abort message entry

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
- **November 29, 2025** - Enhanced job posting: banner message with rules + button, "Samples" field in modal, improved job format, repositioning banner after each job
- **November 29, 2025** - Updated job posting: button always stays at bottom (repositioned after each job), added ✔️ and ❌ reactions to job posts
- **November 29, 2025** - Added complete job posting system: `/jobconfig`, "Post Job" button, modal forms, cooldown tracking, role restrictions, automatic thread creation
- **November 29, 2025** - Updated sticky messages to use message collection, add replace logic (one per channel), and auto-repost at bottom
- **November 29, 2025** - Added /unsticky command to remove sticky messages
- **November 29, 2025** - Updated announcement and scheduler to use message collection (multi-line, formatted messages with 120-second timeout)
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
