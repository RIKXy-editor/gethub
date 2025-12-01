import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';
import { getGiveaway, getEntries } from '../utils/storage.js';
import { selectWinners } from '../utils/giveawayManager.js';

export const data = new SlashCommandBuilder()
  .setName('greroll')
  .setDescription('Reroll winners for a finished giveaway')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(option =>
    option
      .setName('message_id')
      .setDescription('Message ID of the giveaway')
      .setRequired(true)
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This bot is private.', ephemeral: true });
    return;
  }

  const messageId = interaction.options.getString('message_id');
  const giveaway = getGiveaway(interaction.guildId, messageId);

  if (!giveaway) {
    await interaction.reply({
      content: '❌ Giveaway not found.',
      ephemeral: true
    });
    return;
  }

  if (!giveaway.ended) {
    await interaction.reply({
      content: '❌ Giveaway must be ended before rerolling.',
      ephemeral: true
    });
    return;
  }

  try {
    const channel = await interaction.guild.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(messageId);

    // Get valid entries
    let entries = getEntries(interaction.guildId, messageId);
    const validEntries = [];

    for (const entry of entries) {
      try {
        const member = await interaction.guild.members.fetch(entry.userId);
        
        // Check required role
        if (giveaway.requiredRoleId && !member.roles.cache.has(giveaway.requiredRoleId)) {
          continue;
        }
        
        validEntries.push(entry);
      } catch (error) {
        continue;
      }
    }

    // Select new winners
    const winnerIds = selectWinners(validEntries, giveaway.winnerCount, giveaway.multiplierRoles);

    // Update embed
    const embed = message.embeds[0];
    if (embed) {
      const newEmbed = EmbedBuilder.from(embed);
      
      let winnerText = 'No valid entries';
      if (winnerIds.length > 0) {
        winnerText = winnerIds.map(id => `<@${id}>`).join(', ');
      }

      const detailsField = newEmbed.data.fields.find(f => f.name === '🎯 Giveaway Details');
      if (detailsField) {
        const lines = detailsField.value.split('\n');
        lines[1] = `**Winner(s):** ${winnerText}`;
        detailsField.value = lines.join('\n');
      }

      newEmbed.setFooter({ text: '✅ Giveaway has ended (rerolled).' });

      await message.edit({ embeds: [newEmbed] });
    }

    // Send DMs to new winners
    for (const winnerId of winnerIds) {
      try {
        const winner = await interaction.client.users.fetch(winnerId);
        await winner.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('🎉 You Won (Reroll)!')
              .setDescription(`Congratulations! You've won: **${giveaway.prize}**`)
              .setFooter({ text: 'Thank you for participating!' })
          ]
        });
      } catch (error) {
        console.error(`Could not DM winner ${winnerId}:`, error);
      }
    }

    await interaction.reply({
      content: `✅ Reroll complete! New winners: ${winnerIds.length > 0 ? winnerIds.map(id => `<@${id}>`).join(', ') : 'None'}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error rerolling giveaway:', error);
    await interaction.reply({
      content: '❌ Error rerolling giveaway.',
      ephemeral: true
    });
  }
}
