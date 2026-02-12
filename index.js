import { Client, GatewayIntentBits, Partials, REST, Routes, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleJobButton } from './src/handlers/buttonHandler.js';
import { handleJobModal } from './src/handlers/modalHandler.js';
import { handleModal as handleWelcomeModal } from './src/commands/welcome.js';
import { handleTicketInteraction, handleRating } from './src/commands/ticket.js';
import { handleAppealButton, handleAppealModal, handleDenyModal, handleAskInfoModal } from './src/handlers/appealHandler.js';
import { createAdminRoutes } from './src/admin/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [
    Partials.Channel
  ]
});

const commands = new Map();
const events = new Map();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'src', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(`file://${filePath}`);
    commands.set(command.data.name, command);
  }

  console.log(`Loaded ${commands.size} commands`);
}

async function loadEvents() {
  const eventsPath = path.join(__dirname, 'src', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(`file://${filePath}`);
    events.set(event.name, event);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }

  console.log(`Loaded ${events.size} events`);
}

async function deployCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    const commandArray = Array.from(commands.values()).map(cmd => cmd.data.toJSON());

    await new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN).put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commandArray }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}

client.on('interactionCreate', async interaction => {
  // Handle string select menus (ticket category selection)
  if (interaction.isStringSelectMenu()) {
    try {
      if (interaction.customId.startsWith('ticket:')) {
        await handleTicketInteraction(interaction);
      }
    } catch (error) {
      console.error('Error handling select menu:', error);
    }
    return;
  }

  // Handle buttons
  if (interaction.isButton()) {
    try {
      // Handle ticket buttons
      if (interaction.customId.startsWith('ticket:')) {
        if (interaction.customId.startsWith('ticket:rate:')) {
          await handleRating(interaction);
        } else {
          await handleTicketInteraction(interaction);
        }
        return;
      }
      
      // Handle appeal buttons
      if (interaction.customId.startsWith('appeal:')) {
        await handleAppealButton(interaction);
        return;
      }
      
      // Handle giveaway entry buttons
      if (interaction.customId.startsWith('giveaway_enter')) {
        const { handleGiveawayEntry } = await import('./src/handlers/buttonHandler.js');
        await handleGiveawayEntry(interaction);
        return;
      }
      
      await handleJobButton(interaction);
    } catch (error) {
      console.error('Error handling button:', error);
    }
    return;
  }

  // Handle modals
  if (interaction.isModalSubmit()) {
    try {
      // Handle appeal modals first
      if (interaction.customId.startsWith('appeal:')) {
        const appealHandled = await handleAppealModal(interaction);
        if (!appealHandled) {
          const denyHandled = await handleDenyModal(interaction);
          if (!denyHandled) {
            await handleAskInfoModal(interaction);
          }
        }
        return;
      }
      
      const welcomeHandled = await handleWelcomeModal(interaction);
      if (!welcomeHandled) {
        await handleJobModal(interaction);
      }
    } catch (error) {
      console.error('Error handling modal:', error);
    }
    return;
  }

  // Handle commands
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.guildId || interaction.guildId !== process.env.DISCORD_GUILD_ID) {
    await interaction.reply({
      content: '❌ This bot is private and can only be used in the authorized server.',
      ephemeral: true
    });
    const source = interaction.guildId ? `guild ${interaction.guildId}` : 'DM';
    console.log(`Unauthorized access attempt from ${source} by user ${interaction.user.tag}`);
    return;
  }

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    if (error.code === 10062 || error.code === 40060) {
      console.warn(`Interaction error (likely timed out or already handled): ${error.message}`);
      return;
    }
    console.error(`Error executing ${interaction.commandName}:`, error);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ There was an error while executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ There was an error while executing this command!', ephemeral: true });
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
});

async function startServer() {
  const app = express();
  const dev = process.env.NODE_ENV !== 'production';
  const port = dev ? (process.env.API_PORT || 3001) : (process.env.PORT || 5000);
  
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
  }));
  
  app.options('*', cors());
  
  app.use(express.json());
  
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'ticket-admin-secret-key-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production', 
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, 
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
  }));
  
  app.use('/admin', (req, res, next) => {
    console.log(`Admin route: ${req.method} ${req.path}`);
    next();
  }, createAdminRoutes(client));
  
  if (dev) {
    app.get('/', (req, res) => {
      res.json({ status: 'Bot API running', dashboard: 'Use the dashboard workflow on port 5000' });
    });
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`Bot API running on port ${port}`);
    });
  } else {
    const next = (await import('next')).default;
    const nextApp = next({ 
      dev: false, 
      dir: path.join(__dirname, 'dashboard')
    });
    const handle = nextApp.getRequestHandler();
    
    await nextApp.prepare();
    console.log('Next.js app prepared');
    
    app.all('*', (req, res) => {
      return handle(req, res);
    });
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port} (production mode)`);
    });
  }
}

async function start() {
  try {
    await loadCommands();
    await loadEvents();
    await deployCommands();
    await startServer();
    
    if (process.env.DISCORD_TOKEN) {
      await client.login(process.env.DISCORD_TOKEN);
    } else {
      console.warn('DISCORD_TOKEN not set - bot will not connect to Discord');
    }
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

start();
