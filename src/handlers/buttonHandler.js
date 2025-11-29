import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } from 'discord.js';
import { getJobConfig, getCooldownExpiry } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export async function handleJobButton(interaction) {
  if (interaction.guildId !== GUILD_ID) return;

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
