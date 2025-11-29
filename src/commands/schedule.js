import { SlashCommandBuilder } from 'discord.js';
import { addScheduledMessage, getScheduledMessages, removeScheduledMessage } from '../utils/storage.js';
import { REPETITION_OPTIONS, GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Schedule messages to be sent at specific times')
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Schedule a new message')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send to').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Message content').setRequired(true))
      .addStringOption(opt =>
        opt
          .setName('time')
          .setDescription('Time in HH:MM format (24-hour)')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('frequency')
          .setDescription('How often to repeat')
          .addChoices(...REPETITION_OPTIONS)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('list')
      .setDescription('List all scheduled messages')
  )
  .addSubcommand(sub =>
    sub
      .setName('remove')
      .setDescription('Remove a scheduled message')
      .addStringOption(opt => opt.setName('id').setDescription('Message ID to remove').setRequired(true))
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'add') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const time = interaction.options.getString('time');
    const frequency = interaction.options.getString('frequency');

    addScheduledMessage({
      guildId: GUILD_ID,
      channelId: channel.id,
      message,
      time,
      frequency,
      lastRun: 0
    });

    await interaction.reply({
      content: `✅ Message scheduled for ${time} (${frequency}) in ${channel}`,
      ephemeral: true
    });
  } else if (subcommand === 'list') {
    const messages = getScheduledMessages().filter(m => m.guildId === GUILD_ID);
    if (messages.length === 0) {
      await interaction.reply({ content: 'No scheduled messages', ephemeral: true });
    } else {
      const list = messages.map(m => `**${m.id}**: ${m.time} (${m.frequency}) → <#${m.channelId}>`).join('\n');
      await interaction.reply({ content: list, ephemeral: true });
    }
  } else if (subcommand === 'remove') {
    const id = parseInt(interaction.options.getString('id'));
    removeScheduledMessage(id);
    await interaction.reply({ content: '✅ Scheduled message removed', ephemeral: true });
  }
}
