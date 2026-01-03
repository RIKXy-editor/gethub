import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getJobConfig, addCooldown, setJobConfig, getJobBannerText } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export async function handleJobModal(interaction) {
  if (interaction.guildId !== GUILD_ID) return;

  if (interaction.customId !== 'job_posting_modal') return;

  const want = interaction.fields.getTextInputValue('job_want');
  const type = interaction.fields.getTextInputValue('job_type');
  const contract = interaction.fields.getTextInputValue('job_contract');
  const budget = interaction.fields.getTextInputValue('job_budget');
  const samples = interaction.fields.getTextInputValue('job_samples') || 'Not provided';

  const config = getJobConfig(GUILD_ID);
  const targetChannelId = config.channelId || process.env.JOB_CHANNEL_ID || interaction.channelId;

  if (!targetChannelId) {
    return await interaction.reply({
      content: '❌ Error: no valid channel ID configured. Please run `/jobconfig` to set up the job posting channel.',
      ephemeral: true
    });
  }

  const channel = await interaction.client.channels.fetch(targetChannelId);

  const jobMessage = `Want: ${want}\n\nVideo Type: ${type}\n\nContract: ${contract}\n\nBudget: ${budget}\n\nSamples: ${samples}\n\nDM ${interaction.user} or reply in the thread below to work with them.`;

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

    // Delete old banner message if it exists
    if (config.buttonMessageId) {
      try {
        const oldBanner = await channel.messages.fetch(config.buttonMessageId).catch(() => null);
        if (oldBanner) {
          await oldBanner.delete().catch(() => null);
        }
      } catch (deleteError) {
        console.log('Could not delete old banner message');
      }
    }

    // Post new banner + button message at the bottom
    const button = new ButtonBuilder()
      .setCustomId('post_job_button')
      .setLabel('Post Job')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    const bannerContent = getJobBannerText(GUILD_ID);
    const bannerMessage = await channel.send({ 
      content: bannerContent,
      components: [row] 
    });
    setJobConfig(GUILD_ID, { buttonMessageId: bannerMessage.id });

    // Add cooldown
    addCooldown(interaction.user.id);

    // Send confirmation to user
    await interaction.reply({
      content: `✅ Your job has been posted!\n\n[View Job](${postedJob.url})`,
      ephemeral: true
    });

    // Send success DM with embed
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('✅ Job Posted Successfully!')
        .setDescription(`Your job listing has been posted in the server.\n\n⚠️ **WARNING:** We do not allow agencies to post jobs, any hiring jobs, or free jobs. Violating this rule may result in a ban.`)
        .addFields(
          { name: '📋 Job Details', value: want.substring(0, 1024) },
          { name: '🔗 Link to Post', value: `[Click here to view your post](${postedJob.url})` }
        )
        .setTimestamp();

      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.log(`Could not send DM to ${interaction.user.tag}: ${dmError.message}`);
    }
  } catch (error) {
    console.error('Error posting job:', error);
    try {
      await interaction.reply({
        content: '❌ Failed to post job. Please try again.',
        ephemeral: true
      });
    } catch (replyError) {
      console.error('Could not send error reply:', replyError);
    }
  }
}
