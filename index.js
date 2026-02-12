import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleJobButton } from './src/handlers/buttonHandler.js';
import { handleJobModal } from './src/handlers/modalHandler.js';
import { handleModal as handleWelcomeModal } from './src/commands/welcome.js';
import { handleAppealButton, handleAppealModal, handleDenyModal, handleAskInfoModal } from './src/handlers/appealHandler.js';
import { routeTicketInteraction, handleEmailModal } from './src/services/ticketService.js';
import { initializeDatabase, seedDefaultData } from './src/db/schema.js';
import { createWebServer } from './src/web/server.js';
import { startReminderScheduler } from './src/services/reminderService.js';

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
  if (interaction.isButton()) {
    try {
      if (interaction.customId.startsWith('ticket:')) {
        await routeTicketInteraction(interaction);
        return;
      }

      if (interaction.customId.startsWith('appeal:')) {
        await handleAppealButton(interaction);
        return;
      }

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

  if (interaction.isModalSubmit()) {
    try {
      if (interaction.customId.startsWith('ticket:email_modal:')) {
        await handleEmailModal(interaction);
        return;
      }

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

async function start() {
  try {
    await initializeDatabase();

    if (process.env.DISCORD_GUILD_ID) {
      await seedDefaultData(process.env.DISCORD_GUILD_ID);
    }

    await loadCommands();
    await loadEvents();
    await deployCommands();

    const app = createWebServer(client);
    app.listen(5000, '0.0.0.0', () => {
      console.log('Dashboard running on http://0.0.0.0:5000');
    });

    if (process.env.DISCORD_TOKEN) {
      await client.login(process.env.DISCORD_TOKEN);
      startReminderScheduler(client);
    } else {
      console.warn('DISCORD_TOKEN not set - bot will not connect to Discord');
    }
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

start();
