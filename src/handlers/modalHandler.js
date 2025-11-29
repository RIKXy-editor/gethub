import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getJobConfig, addCooldown } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export async function handleJobModal(interaction) {
  if (interaction.guildId !== GUILD_ID) return;

  if (interaction.customId !== 'job_posting_modal') return;

  const want = interaction.fields.getTextInputValue('job_want');
  const type = interaction.fields.getTextInputValue('job_type');
  const contract = interaction.fields.getTextInputValue('job_contract');
  const budget = interaction.fields.getTextInputValue('job_budget');

  const config = getJobConfig(GUILD_ID);
  const channel = await interaction.client.channels.fetch(config.channelId);

  const jobMessage = `**Want:** ${want}\n\n**Video Type:** ${type}\n\n**Contract:** ${contract}\n\n**Budget:** ${budget}\n\nDM ${interaction.user} for work with them.`;

  try {
    const postedJob = await channel.send(jobMessage);

    // Create thread
    const threadName = `Job: ${want.substring(0, 30)}... - ${interaction.user.username}`;
    await postedJob.thread.create({
      name: threadName.substring(0, 100)
    });

    // Add cooldown
    addCooldown(interaction.user.id);

    // Send confirmation to user
    await interaction.reply({
      content: `✅ Your job has been posted!\n\n[View Job](${postedJob.url})`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error posting job:', error);
    await interaction.reply({
      content: '❌ Failed to post job. Please try again.',
      ephemeral: true
    });
  }
}
