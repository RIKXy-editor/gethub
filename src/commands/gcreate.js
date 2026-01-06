import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';
import { addGiveaway } from '../utils/storage.js';
import { parseDuration, getGiveawayTitle } from '../utils/giveawayManager.js';

export const data = new SlashCommandBuilder()
  .setName('gcreate')
  .setDescription('Create a new giveaway')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel to post the giveaway in')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('prize')
      .setDescription('What the winner gets')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('duration')
      .setDescription('Duration (e.g., 10m, 2h, 1d)')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('winners')
      .setDescription('Number of winners (default 1)')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option
      .setName('required_role')
      .setDescription('Role required to enter (optional)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('multiplier_roles')
      .setDescription('Role IDs with multipliers (e.g., 123456:2,789012:3)')
      .setRequired(false)
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This bot is private.', ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel('channel');
  const prize = interaction.options.getString('prize');
  const durationStr = interaction.options.getString('duration');
  const winnerCount = interaction.options.getInteger('winners') || 1;
  const requiredRole = interaction.options.getRole('required_role');
  const multiplierStr = interaction.options.getString('multiplier_roles');

  // Parse duration
  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    await interaction.reply({
      content: '❌ Invalid duration format. Use 10m, 2h, 1d, etc.',
      ephemeral: true
    });
    return;
  }

  // Parse multiplier roles
  let multiplierRoles = {};
  if (multiplierStr) {
    try {
      const pairs = multiplierStr.split(',');
      for (const pair of pairs) {
        const [roleId, multiplier] = pair.trim().split(':');
        multiplierRoles[roleId.trim()] = parseInt(multiplier.trim());
      }
    } catch (error) {
      await interaction.reply({
        content: '❌ Invalid multiplier format. Use: 123456:2,789012:3',
        ephemeral: true
      });
      return;
    }
  }

  const endTime = Date.now() + durationMs;
  const endTimestamp = Math.floor(endTime / 1000);

  try {
    // Build embed
    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle(`🎁 ${getGiveawayTitle()}`)
      .addFields(
        {
          name: '🎯 Giveaway Details',
          value: `**Prize:** ${prize}\n**Winner(s):** TBD\n**Host:** <@${interaction.user.id}>\n**Ends:** <t:${endTimestamp}:F> (<t:${endTimestamp}:R>)`,
          inline: false
        }
      );

    // Add multiplier section if configured
    if (Object.keys(multiplierRoles).length > 0) {
      let multiplierText = '';
      for (const [roleId, multiplier] of Object.entries(multiplierRoles)) {
        multiplierText += `<@&${roleId}> – x${multiplier} entries\n`;
      }
      embed.addFields({
        name: '📊 Multiplier',
        value: multiplierText.trim(),
        inline: false
      });
    }

    // Add requirements section if set
    if (requiredRole) {
      embed.addFields({
        name: '📋 Requirements',
        value: `Any of the Required Role(s) – ${requiredRole}`,
        inline: false
      });
    }

    embed.addFields({
      name: '👥 Entries',
      value: '0',
      inline: false
    });

    embed.setFooter({ text: 'Click the button below to enter!' });

    // Send embed
    const giveawayMessage = await channel.send({ embeds: [embed] });

    // Add entry button
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const button = new ButtonBuilder()
      .setCustomId(`giveaway_enter_${giveawayMessage.id}`)
      .setLabel('✨ Enter Giveaway')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    await giveawayMessage.edit({ components: [row] });

    // Store giveaway data
    const giveawayData = {
      messageId: giveawayMessage.id,
      channelId: channel.id,
      guildId: interaction.guildId,
      prize,
      endTime,
      winnerCount,
      requiredRoleId: requiredRole?.id || null,
      multiplierRoles,
      hostId: interaction.user.id,
      ended: false
    };

    addGiveaway(interaction.guildId, giveawayData);

    await interaction.reply({
      content: `✅ Giveaway created! Message: [Jump to giveaway](${giveawayMessage.url})`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error creating giveaway:', error);
    await interaction.reply({
      content: '❌ Error creating giveaway.',
      ephemeral: true
    });
  }
}
