import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getJobConfig, getCooldownExpiry, addEntry, hasEntry, getEntries } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export async function handleJobButton(interaction) {
  if (interaction.guildId !== GUILD_ID) return;

  // Handle giveaway entry button
  if (interaction.customId.startsWith('giveaway_enter_')) {
    await handleGiveawayEntry(interaction);
    return;
  }

  if (interaction.customId !== 'post_job_button') return;

  const config = getJobConfig(GUILD_ID);

  // Check role restriction
  if (config.roleId) {
    if (!interaction.member.roles.cache.has(config.roleId)) {
      await interaction.reply({
        content: '❌ You do not have permission to post jobs.',
        ephemeral: true
      });
      return;
    }
  }

  // Check cooldown (admins bypass cooldown)
  const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
  if (!isAdmin) {
    const cooldownLeft = getCooldownExpiry(interaction.user.id, config.cooldownMinutes);
    if (cooldownLeft > 0) {
      await interaction.reply({
        content: `⏳ You are on cooldown. Please wait ${cooldownLeft} seconds before posting another job.`,
        ephemeral: true
      });
      return;
    }
  }

  const modal = new ModalBuilder()
    .setCustomId('job_posting_modal')
    .setTitle('Post a Job');

  const warningInput = new TextInputBuilder()
    .setCustomId('job_warning')
    .setLabel('⚠️ READ CAREFULLY ⚠️')
    .setStyle(TextInputStyle.Short)
    .setValue('NO AGENCIES | NO HIRING | NO FREE JOBS')
    .setRequired(false);

  const wantInput = new TextInputBuilder()
    .setCustomId('job_want')
    .setLabel('Want')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Example: Need an editor for gaming highlights…')
    .setRequired(true);

  const typeInput = new TextInputBuilder()
    .setCustomId('job_type')
    .setLabel('Video Type')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('YouTube / Reels / Shorts / Ads etc.')
    .setRequired(true);

  const contractInput = new TextInputBuilder()
    .setCustomId('job_contract')
    .setLabel('Contract')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('One-time / Monthly / Long-term')
    .setRequired(true);

  const budgetInput = new TextInputBuilder()
    .setCustomId('job_budget')
    .setLabel('Budget')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 3000 INR / video, $50 / video, Negotiable')
    .setRequired(true);

  const samplesInput = new TextInputBuilder()
    .setCustomId('job_samples')
    .setLabel('Samples (YouTube / Drive links)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Example: https://youtube.com/...  https://drive.google.com/...')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(warningInput),
    new ActionRowBuilder().addComponents(wantInput),
    new ActionRowBuilder().addComponents(typeInput),
    new ActionRowBuilder().addComponents(contractInput),
    new ActionRowBuilder().addComponents(budgetInput)
    // Note: Max 5 components per modal, removing samples to make room for warning
  );

  await interaction.showModal(modal);
}

async function handleGiveawayEntry(interaction) {
  try {
    const messageId = interaction.customId.split('_')[2];
    const { getGiveaway } = await import('../utils/storage.js');
    
    const giveaway = getGiveaway(interaction.guildId, messageId);
    
    if (!giveaway || giveaway.ended) {
      await interaction.reply({
        content: '❌ This giveaway is no longer active.',
        ephemeral: true
      });
      return;
    }

    // Check required role
    if (giveaway.requiredRoleId) {
      if (!interaction.member.roles.cache.has(giveaway.requiredRoleId)) {
        await interaction.reply({
          content: `❌ You don't have the required role to enter.`,
          ephemeral: true
        });
        return;
      }
    }

    // Check if already entered
    if (hasEntry(interaction.guildId, messageId, interaction.user.id)) {
      await interaction.reply({
        content: '❌ You\'ve already entered this giveaway.',
        ephemeral: true
      });
      return;
    }

    // Get user roles for multiplier calculation
    const userRoles = Array.from(interaction.member.roles.cache.keys());

    // Add entry
    addEntry(interaction.guildId, messageId, interaction.user.id, userRoles);

    // Update embed entry count
    try {
      const message = await interaction.channel.messages.fetch(messageId);
      const embed = message.embeds[0];
      
      if (embed) {
        const newEmbed = EmbedBuilder.from(embed);
        const entries = getEntries(interaction.guildId, messageId);
        
        newEmbed.spliceFields(
          newEmbed.data.fields.findIndex(f => f.name === '👥 Entries'),
          1,
          { name: '👥 Entries', value: entries.length.toString(), inline: false }
        );
        
        await message.edit({ embeds: [newEmbed] });
      }
    } catch (error) {
      console.log('Could not update entry count:', error.message);
    }

    await interaction.reply({
      content: '✅ You\'ve entered the giveaway!',
      ephemeral: true
    });
  } catch (error) {
    console.error('Error handling giveaway entry:', error);
    await interaction.reply({
      content: '❌ Error entering giveaway.',
      ephemeral: true
    }).catch(() => {});
  }
}
