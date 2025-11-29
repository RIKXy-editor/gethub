import { SlashCommandBuilder } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Send an announcement to a channel (you will be prompted for the message)')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel to send announcement to')
      .setRequired(true)
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  const targetChannel = interaction.options.getChannel('channel');

  await interaction.reply({
    content: "📝 What is the announcement message content? Type 'cancel' to stop.",
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
        content: '❌ Announcement cancelled.',
        ephemeral: true
      });
      return;
    }

    const announcementContent = userMessage.content;

    await targetChannel.send(announcementContent);

    await interaction.followUp({
      content: `✅ Announcement sent to ${targetChannel}`,
      ephemeral: true
    });
  } catch (error) {
    if (error.code === 'INTERACTION_TOKEN_INVALID') {
      console.log('Announcement timed out - interaction already responded');
    } else if (error.message === 'Awaiting messages timed out after 120000ms') {
      await interaction.followUp({
        content: '⏱️ Announcement prompt timed out. Please try again.',
        ephemeral: true
      }).catch(() => console.log('Could not send timeout message'));
    } else {
      console.error('Error in announcement command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while sending the announcement.',
        ephemeral: true
      }).catch(() => console.log('Could not send error message'));
    }
  }
}
