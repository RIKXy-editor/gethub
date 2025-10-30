import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActivityType } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel
  ]
});

const statuses = [
  { name: 'Managing Editors Club', type: ActivityType.Playing },
  { name: 'Editing Videos', type: ActivityType.Playing },
  { name: 'Searching Assets', type: ActivityType.Playing },
  { name: 'Rendering Projects', type: ActivityType.Playing },
  { name: 'Color Grading', type: ActivityType.Playing },
  { name: 'Audio Mixing', type: ActivityType.Playing },
  { name: 'Exporting Videos', type: ActivityType.Playing },
  { name: 'Managing Tickets', type: ActivityType.Watching }
];

let currentStatusIndex = 0;

const commands = [
  new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Send a reminder DM to a user about their open ticket')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to remind')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('ticket')
        .setDescription('Ticket number or description')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('Optional custom message to include')
        .setRequired(false)
    )
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands.map(command => command.toJSON()) }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error deploying commands:', error);
  }
}

function updateStatus() {
  const status = statuses[currentStatusIndex];
  client.user.setActivity(status.name, { type: status.type });
  currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
}

client.once('ready', async () => {
  console.log(`Bot is ready! Logged in as ${client.user.tag}`);
  await deployCommands();
  
  updateStatus();
  setInterval(updateStatus, 15000);
  console.log('Rotating status started!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'remind') {
    const targetUser = interaction.options.getUser('user');
    const ticketInfo = interaction.options.getString('ticket');
    const customMessage = interaction.options.getString('message');

    try {
      const embed = new EmbedBuilder()
        .setColor(0xFF9900)
        .setTitle('🎫 Ticket Reminder')
        .setDescription('This is a friendly reminder about your open ticket.')
        .addFields(
          { name: 'Ticket', value: ticketInfo, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: `Reminder sent by ${interaction.user.tag}` });

      if (customMessage) {
        embed.addFields({ name: 'Additional Message', value: customMessage, inline: false });
      }

      await targetUser.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Successfully sent a reminder to ${targetUser.tag} about ticket: ${ticketInfo}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error sending DM:', error);
      
      await interaction.reply({
        content: `❌ Failed to send DM to ${targetUser.tag}. They may have DMs disabled or have blocked the bot.`,
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
