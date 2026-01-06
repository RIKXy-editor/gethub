import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';
import { getAllGiveaways } from '../utils/storage.js';

export const data = new SlashCommandBuilder()
  .setName('glist')
  .setDescription('List all active giveaways');

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This bot is private.', ephemeral: true });
    return;
  }

  try {
    const allGiveaways = getAllGiveaways(interaction.guildId);
    const activeGiveaways = Object.values(allGiveaways).filter(g => !g.ended);

    if (activeGiveaways.length === 0) {
      await interaction.reply({
        content: '❌ No active giveaways.',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('🎁 Active Giveaways');

    for (const giveaway of activeGiveaways) {
      const timeRemaining = Math.floor((giveaway.endTime - Date.now()) / 1000);
      const endTimestamp = Math.floor(giveaway.endTime / 1000);

      let fieldValue = `**Prize:** ${giveaway.prize}\n`;
      fieldValue += `**Channel:** <#${giveaway.channelId}>\n`;
      fieldValue += `**Time Remaining:** <t:${endTimestamp}:R>\n`;
      fieldValue += `**Winners:** ${giveaway.winnerCount}`;

      embed.addFields({
        name: `Message: ${giveaway.messageId}`,
        value: fieldValue,
        inline: false
      });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  } catch (error) {
    console.error('Error listing giveaways:', error);
    await interaction.reply({
      content: '❌ Error retrieving giveaways.',
      ephemeral: true
    });
  }
}
