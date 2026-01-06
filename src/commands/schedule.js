import { SlashCommandBuilder } from 'discord.js';
import { addScheduledMessage, getScheduledMessages, removeScheduledMessage } from '../utils/storage.js';
import { REPETITION_OPTIONS, GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('schedule')
  .setDescription('Schedule messages to be sent at specific times')
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Schedule a new message (you will be prompted for the message)')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send to').setRequired(true))
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
    const time = interaction.options.getString('time');
    const frequency = interaction.options.getString('frequency');

    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(time)) {
      await interaction.reply({
        content: '❌ Invalid time format. Use HH:MM (24-hour format).',
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: "📝 What is the message's content? Type 'cancel' to stop.",
      ephemeral: true
    });

    try {
      const messageFilter = msg => msg.author.id === interaction.user.id && msg.channelId === interaction.channelId;
      const collected = await interaction.channel.awaitMessages({
        filter: messageFilter,
        max: 1,
        time: 120000,
        errors: ['time']
      });

      const userMessage = collected.first();

      if (userMessage.content.toLowerCase() === 'cancel') {
        await interaction.followUp({
          content: '❌ Scheduling cancelled.',
          ephemeral: true
        });
        return;
      }

      const messageContent = userMessage.content;

      addScheduledMessage({
        guildId: GUILD_ID,
        channelId: channel.id,
        message: messageContent,
        time,
        frequency,
        lastRun: 0
      });

      await interaction.followUp({
        content: `✅ Message scheduled for ${time} (${frequency}) in ${channel}\n\nMessage preview:\n\`\`\`\n${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}\n\`\`\``,
        ephemeral: true
      });
    } catch (error) {
      if (error.code === 'INTERACTION_TOKEN_INVALID') {
        console.log('Schedule timed out - interaction already responded');
      } else if (error.message === 'Awaiting messages timed out after 120000ms') {
        await interaction.followUp({
          content: '⏱️ Schedule prompt timed out. Please try again.',
          ephemeral: true
        }).catch(() => console.log('Could not send timeout message'));
      } else {
        console.error('Error in schedule command:', error);
        await interaction.followUp({
          content: '❌ An error occurred while scheduling the message.',
          ephemeral: true
        }).catch(() => console.log('Could not send error message'));
      }
    }
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
