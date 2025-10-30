# Discord Ticket Reminder Bot

## Overview
A Discord bot that helps moderators and users remind people about their open tickets. The bot uses Discord's slash commands and sends direct messages to users as reminders.

**Current Status:** Active and running
**Last Updated:** October 30, 2025

## Features
- `/remind` slash command to send ticket reminders via DM
- Beautiful embedded reminder messages
- Optional custom messages
- Tracks who sent the reminder
- Rotating status messages showing editing-related activities (changes every 15 seconds)
- **Private bot security** - Only works in the authorized server, blocks all other servers and DMs

## Project Structure
```
.
├── index.js           # Main bot file with command handler
├── package.json       # Node.js dependencies
├── .gitignore        # Git ignore patterns
└── replit.md         # This file
```

## How to Use

### The /remind Command
Use the `/remind` command in your Discord server to send a ticket reminder:

```
/remind user:@username ticket:"Ticket #123" message:"Please update your ticket"
```

**Required Parameters:**
- `user` - The Discord user to remind (mention them)
- `ticket` - Ticket number or description

**Optional Parameters:**
- `message` - Custom message to include in the reminder

**Example:**
```
/remind user:@JohnDoe ticket:"Support Ticket #456" message:"We're waiting for your response"
```

The bot will:
1. Send a DM to the specified user with an embedded reminder
2. Include the ticket information
3. Show who sent the reminder
4. Confirm to you that the message was sent (only you can see this)

## Setup Information

### Required Secrets
The following environment variables are configured:
- `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` - Application client ID
- `DISCORD_GUILD_ID` - Your Discord server ID

### Bot Permissions Required
Make sure your bot has these permissions in Discord:
- Send Messages
- Send Messages in Threads (if using tickets in threads)
- Embed Links
- Use Slash Commands

### Invite Link
To add the bot to your server, use this URL structure:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877975552&scope=bot%20applications.commands
```
Replace `YOUR_CLIENT_ID` with your actual Discord Client ID.

## Technical Details

### Dependencies
- **discord.js v14.14.1** - Discord API wrapper
- **Node.js 20** - JavaScript runtime

### Command Registration
Slash commands are automatically registered when the bot starts. Commands are registered as guild commands for instant updates.

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
The bot includes strict access controls to ensure it only works in your authorized server:
- **Guild Verification**: Commands only work in the server specified by `DISCORD_GUILD_ID`
- **DM Protection**: Commands sent via direct messages are rejected
- **Unauthorized Access Logging**: All unauthorized attempts are logged with source information
- Private bot ensures no one else can use it, even if they somehow get the invite link

### Error Handling
- The bot handles cases where users have DMs disabled
- Provides clear error messages when DM delivery fails
- All responses are ephemeral (only visible to command user)
- Unauthorized access attempts receive a clear rejection message

## Recent Changes
- **October 30, 2025**: Added private bot security with guild verification and DM blocking
- **October 30, 2025**: Added rotating status feature with editing-related activities
- **October 30, 2025**: Initial bot creation with `/remind` command

## User Preferences
- Uses embedded messages for better visual presentation
- Commands are ephemeral to keep server channels clean
- Simple, straightforward interface for ease of use
