import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    console.error(`Error executing ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ There was an error while executing this command!', ephemeral: true });
    }
  }
});

async function start() {
  await loadCommands();
  await loadEvents();
  await deployCommands();
  await client.login(process.env.DISCORD_TOKEN);
}

start();
