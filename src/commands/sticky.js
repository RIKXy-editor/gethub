import { SlashCommandBuilder } from 'discord.js';
import { addStickyMessage, getStickyMessage, removeStickyMessage } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('Create or update a sticky message in this channel with message collection');

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  const channel = interaction.channel;

  await interaction.reply({
    content: "📝 What is the sticky message content? Type 'cancel' to stop.",
    ephemeral: true
  });

  try {
    const messageFilter = msg => msg.author.id === interaction.user.id && msg.channelId === channel.id;
    const collected = await channel.awaitMessages({
      filter: messageFilter,
      max: 1,
      time: 120000,
      errors: ['time']
    });

    const userMessage = collected.first();

    if (userMessage.content.toLowerCase() === 'cancel') {
      await interaction.followUp({
        content: '❌ Sticky message cancelled.',
        ephemeral: true
      });
      return;
    }

    const stickyContent = userMessage.content;

    // Check if sticky already exists in this channel
    const existingSticky = getStickyMessage(GUILD_ID, channel.id);
    
    if (existingSticky) {
      try {
        const oldMessage = await channel.messages.fetch(existingSticky.messageId);
        await oldMessage.delete();
      } catch (error) {
        console.log('Old sticky message already deleted or inaccessible');
      }
    }

    const stickyMessage = await channel.send(stickyContent);
    addStickyMessage(GUILD_ID, channel.id, stickyMessage.id, stickyContent);

    await interaction.followUp({
      content: `✅ Sticky message ${existingSticky ? 'updated' : 'created'} in ${channel}`,
      ephemeral: true
    });
  } catch (error) {
    if (error.code === 'INTERACTION_TOKEN_INVALID') {
      console.log('Sticky command timed out - interaction already responded');
    } else if (error.message === 'Awaiting messages timed out after 120000ms') {
      await interaction.followUp({
        content: '⏱️ Sticky message prompt timed out. Please try again.',
        ephemeral: true
      }).catch(() => console.log('Could not send timeout message'));
    } else {
      console.error('Error in sticky command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while creating the sticky message.',
        ephemeral: true
      }).catch(() => console.log('Could not send error message'));
    }
  }
}
