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

  // Handle review start button
  if (interaction.customId === 'review_start') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rate_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rate_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rate_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rate_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rate_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: 'Please select a rating:',
      components: [row],
      ephemeral: true
    });
    return;
  }

  // Handle rating buttons
  if (interaction.customId.startsWith('rate_')) {
    const rating = interaction.customId.split('_')[1];
    const modal = new ModalBuilder()
      .setCustomId(`review_modal_${rating}`)
      .setTitle('Share Your Review ⭐');

    const planInput = new TextInputBuilder()
      .setCustomId('review_plan')
      .setLabel('Subscription Plan')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1 month / 3 month / 6 month / 1 year')
      .setRequired(true);

    const textInput = new TextInputBuilder()
      .setCustomId('review_text')
      .setLabel('Review text')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const screenshotInput = new TextInputBuilder()
      .setCustomId('review_screenshot')
      .setLabel('Screenshot Link (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Imgur / Discord CDN link')
      .setRequired(false);

    const extraInput = new TextInputBuilder()
      .setCustomId('review_extra')
      .setLabel('Extra note (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(planInput),
      new ActionRowBuilder().addComponents(textInput),
      new ActionRowBuilder().addComponents(screenshotInput),
      new ActionRowBuilder().addComponents(extraInput)
    );

    await interaction.showModal(modal);
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
    new ActionRowBuilder().addComponents(wantInput),
    new ActionRowBuilder().addComponents(typeInput),
    new ActionRowBuilder().addComponents(contractInput),
    new ActionRowBuilder().addComponents(budgetInput),
    new ActionRowBuilder().addComponents(samplesInput)
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
