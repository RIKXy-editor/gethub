import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './src/utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = new Map();

async function loadCommands() {
  const commandsPath = path.join(__dirname, 'src', 'commands');
  if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath, { recursive: true });
  
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(`file://${filePath}`);
    commands.set(command.data.name, command);
  }
}

async function deployCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const commandData = Array.from(commands.values()).map(c => c.data.toJSON());
  
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commandData }
    );
    console.log('Successfully registered commands.');
  } catch (error) {
    console.error(error);
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Error executing command.', ephemeral: true });
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

const app = express();
app.get('/', (req, res) => res.send('Bot is online'));
app.listen(process.env.PORT || 3000);

async function start() {
  await loadCommands();
  await deployCommands();
  initDatabase();
  client.login(process.env.DISCORD_TOKEN);
}

start();
