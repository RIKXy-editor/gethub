import { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { getJobBannerText, setJobBannerText, getJobConfig } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('setjobbanner')
  .setDescription('Set custom job banner text (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true
    });
    return;
  }

  await interaction.reply({
    content: `Send the new Job Banner text now (the text above the Post Job button).\nIt can be multi-line.\nType \`cancel\` to stop.`,
    ephemeral: true
  });

  const collectorFilter = msg => msg.author.id === interaction.user.id && msg.channelId === interaction.channelId;

  try {
    const collected = await interaction.channel.awaitMessages({ filter: collectorFilter, max: 1, time: 120000 });
    
    if (collected.size === 0) {
      await interaction.followUp({ content: '⏱️ Timed out. Job banner text not updated.', ephemeral: true });
      return;
    }

    const message = collected.first();
    const text = message.content.trim();

    if (text.toLowerCase() === 'cancel') {
      await interaction.followUp({ content: '❌ Cancelled. Job banner text not updated.', ephemeral: true });
      await message.delete().catch(() => null);
      return;
    }

    setJobBannerText(GUILD_ID, text);

    // Update the banner in the job channel immediately
    const config = getJobConfig(GUILD_ID);
    if (config.channelId && config.buttonMessageId) {
      try {
        const channel = await interaction.client.channels.fetch(config.channelId);
        const oldBanner = await channel.messages.fetch(config.buttonMessageId).catch(() => null);
        if (oldBanner) {
          await oldBanner.delete().catch(() => null);
        }

        const button = new ButtonBuilder()
          .setCustomId('post_job_button')
          .setLabel('Post Job')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);
        const newBanner = await channel.send({ 
          content: text,
          components: [row] 
        });

        // Update config with new message ID
        const updatedConfig = getJobConfig(GUILD_ID);
        updatedConfig.buttonMessageId = newBanner.id;
        const configs = require('../utils/storage.js');
        const allConfigs = configs.loadData('job-config', {});
        allConfigs[GUILD_ID] = updatedConfig;
        configs.saveData('job-config', allConfigs);
      } catch (bannerError) {
        console.error('Error updating job banner in channel:', bannerError);
      }
    }

    await interaction.followUp({ content: '✅ Job banner text updated! Banner has been recreated in the job channel.', ephemeral: true });
    await message.delete().catch(() => null);
  } catch (error) {
    console.error('Error in setjobbanner:', error);
    await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true }).catch(() => null);
  }
}
