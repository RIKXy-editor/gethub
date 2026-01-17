import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getJobConfig, addCooldown, setJobConfig, getJobBannerText, getStickyClientsConfig, setStickyClientsConfig } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';
import { repostStickyClients } from '../events/messageCreate.js';

export async function handleJobModal(interaction) {
  // Handle sticky clients form submission
  if (interaction.customId.startsWith('stickyclients_modal_')) {
    try {
      const guildId = interaction.customId.split('_')[2];
      const config = getStickyClientsConfig(guildId);

      const name = interaction.fields.getTextInputValue('sc_name');
      const role = interaction.fields.getTextInputValue('sc_role');
      const experience = interaction.fields.getTextInputValue('sc_experience');
      const portfolio = interaction.fields.getTextInputValue('sc_portfolio');
      const about = interaction.fields.getTextInputValue('sc_about') || '';

      // Parse about field for social media and profile pic
      let socialMedia = '';
      let profilePic = '';
      let aboutText = about;
      
      const urlMatch = about.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);
      if (urlMatch) {
        profilePic = urlMatch[0];
        aboutText = about.replace(profilePic, '').trim();
      }

      // Create submission embed
      const embed = new EmbedBuilder()
        .setTitle('New Creator Submission')
        .setColor(config.embedColor ? parseInt(config.embedColor.replace('#', ''), 16) : 0x9b59b6)
        .addFields(
          { name: 'Name', value: name, inline: true },
          { name: 'Role', value: role, inline: true },
          { name: 'Experience', value: experience, inline: true }
        )
        .setFooter({ text: 'Posted via Client Form' })
        .setTimestamp();

      // Add portfolio as clickable link
      embed.addFields({ name: 'Portfolio', value: `[Click Here](${portfolio})`, inline: false });

      // Add about/social if provided
      if (aboutText) {
        embed.addFields({ name: 'About', value: aboutText, inline: false });
      }

      // Add thumbnail if profile pic URL found
      if (profilePic) {
        embed.setThumbnail(profilePic);
      } else {
        embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
      }

      // Post to channel
      const channel = await interaction.client.channels.fetch(config.channelId);
      if (!channel) {
        await interaction.reply({ content: 'Error: Channel not found.', ephemeral: true });
        return;
      }

      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });

      await interaction.reply({
        content: 'Your portfolio has been shared!',
        ephemeral: true
      });

      // Repost sticky to keep it at bottom
      setTimeout(() => repostStickyClients(interaction.client, guildId), 2000);

    } catch (error) {
      console.error('Error handling sticky clients modal:', error);
      await interaction.reply({
        content: 'Failed to submit your portfolio. Please try again.',
        ephemeral: true
      }).catch(() => {});
    }
    return;
  }

  if (interaction.customId.startsWith('review_modal_')) {
    const ratingNum = interaction.customId.split('_')[2];
    const plan = interaction.fields.getTextInputValue('review_plan');
    const text = interaction.fields.getTextInputValue('review_text');
    const screenshot = interaction.fields.getTextInputValue('review_screenshot');
    const extra = interaction.fields.getTextInputValue('review_extra');

    const stars = '⭐'.repeat(parseInt(ratingNum));
    const reviewChannelId = '1346744648198131752';

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setAuthor({ 
        name: interaction.user.tag, 
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
      })
      .setTitle('New Review Received!')
      .setDescription(text)
      .addFields(
        { name: 'Customer', value: `${interaction.user} (${interaction.user.id})`, inline: true },
        { name: 'Subscription Plan', value: plan, inline: true },
        { name: 'Rating', value: stars, inline: true }
      )
      .setTimestamp();

    if (extra) {
      embed.addFields({ name: 'Extra Note', value: extra });
    }

    if (screenshot && screenshot.startsWith('http')) {
      embed.setImage(screenshot);
    }

    try {
      const channel = await interaction.client.channels.fetch(reviewChannelId);
      if (channel) {
        await channel.send({ embeds: [embed] });
        await interaction.reply({
          content: '✅ Thanks! Your review has been submitted.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error sending review:', error);
      await interaction.reply({
        content: '❌ Failed to submit review to the destination channel.',
        ephemeral: true
      });
    }
    return;
  }

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
        .setDescription(`Your job listing has been posted in the server.\n\n⚠️ **WARNING:** We do not allow agencies to post jobs or free jobs. Violating this rule may result in a ban.`)
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
