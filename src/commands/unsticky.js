import { SlashCommandBuilder } from 'discord.js';
import { getStickyMessage, removeStickyMessage } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('unsticky')
  .setDescription('Remove the sticky message from this channel');

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  const channel = interaction.channel;
  const existingSticky = getStickyMessage(GUILD_ID, channel.id);

  if (!existingSticky) {
    await interaction.reply({
      content: '❌ There is no sticky message in this channel.',
      ephemeral: true
    });
    return;
  }

  try {
    const oldMessage = await channel.messages.fetch(existingSticky.messageId);
    await oldMessage.delete();
  } catch (error) {
    console.log('Sticky message already deleted or inaccessible');
  }

  removeStickyMessage(GUILD_ID, channel.id);

  await interaction.reply({
    content: '✅ Sticky message removed from this channel.',
    ephemeral: true
  });
}
