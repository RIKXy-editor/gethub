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

    // Create thread (optional - if supported by channel)
    try {
      const threadName = `Job: ${want.substring(0, 30)}... - ${interaction.user.username}`;
      await postedJob.reply({ content: `Thread for discussion` }).then(msg => msg.delete());
      if (postedJob.startThread) {
        await postedJob.startThread({
          name: threadName.substring(0, 100),
          autoArchiveDuration: 10080 // 7 days
        }).catch(() => null); // Silently fail if thread creation not supported
      }
    } catch (threadError) {
      console.log('Thread creation skipped (may not be supported in this channel)');
    }

    // Add cooldown
    addCooldown(interaction.user.id);

    // Send confirmation to user
    await interaction.reply({
      content: `✅ Your job has been posted!\n\n[View Job](${postedJob.url})`,
      flags: 64 // ephemeral flag
    });
  } catch (error) {
    console.error('Error posting job:', error);
    try {
      await interaction.reply({
        content: '❌ Failed to post job. Please try again.',
        flags: 64 // ephemeral flag
      });
    } catch (replyError) {
      console.error('Could not send error reply:', replyError);
    }
  }
}
