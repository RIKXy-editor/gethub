import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getJobConfig, addCooldown, setJobConfig } from '../utils/storage.js';
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
    // Post the job
    const postedJob = await channel.send(jobMessage);

    // Add reactions to job post
    try {
      await postedJob.react('👍');
      await postedJob.react('❌');
    } catch (reactionError) {
      console.error('Error adding reactions:', reactionError);
    }

    // Create thread (optional - if supported by channel)
    try {
      const threadName = `Job: ${want.substring(0, 30)}... - ${interaction.user.username}`;
      if (postedJob.startThread) {
        await postedJob.startThread({
          name: threadName.substring(0, 100),
          autoArchiveDuration: 10080 // 7 days
        }).catch(() => null);
      }
    } catch (threadError) {
      console.log('Thread creation skipped');
    }

    // Delete old button message if it exists
    if (config.buttonMessageId) {
      try {
        const oldButton = await channel.messages.fetch(config.buttonMessageId).catch(() => null);
        if (oldButton) {
          await oldButton.delete().catch(() => null);
        }
      } catch (deleteError) {
        console.log('Could not delete old button message');
      }
    }

    // Post new button message at the bottom
    const button = new ButtonBuilder()
      .setCustomId('post_job_button')
      .setLabel('Post Job')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    const buttonMessage = await channel.send({ components: [row] });
    setJobConfig(GUILD_ID, { buttonMessageId: buttonMessage.id });

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
