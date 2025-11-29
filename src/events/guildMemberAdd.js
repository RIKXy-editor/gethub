import { EmbedBuilder } from 'discord.js';
import { getGuildConfig, getWelcomeText, getWelcomeDmConfig } from '../utils/storage.js';
import { COLORS } from '../utils/constants.js';

export const name = 'guildMemberAdd';

function replacePlaceholders(text, member) {
  return text
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{server}/g, member.guild.name)
    .replace(/{member_count}/g, member.guild.memberCount);
}

export async function execute(member) {
  const config = getGuildConfig(member.guild.id);
  
  if (!config.welcomer || !config.welcomer.enabled) return;

  try {
    // Send channel welcome message
    const channel = await member.guild.channels.fetch(config.welcomer.channelId);
    if (channel) {
      const welcomeTemplate = getWelcomeText(member.guild.id);
      let welcomeText = replacePlaceholders(welcomeTemplate, member);
      await channel.send(`<@${member.id}> ${welcomeText}`);
    }

    // Send DM embed welcome
    try {
      const dmConfig = getWelcomeDmConfig(member.guild.id);
      const titleText = replacePlaceholders(dmConfig.titleTemplate, member);
      const descriptionText = replacePlaceholders(dmConfig.descriptionTemplate, member);

      const embed = new EmbedBuilder()
        .setTitle(titleText)
        .setDescription(descriptionText)
        .setColor(COLORS.info);

      if (dmConfig.thumbnailUrl) {
        embed.setThumbnail(dmConfig.thumbnailUrl);
      }

      if (dmConfig.imageUrl) {
        embed.setImage(dmConfig.imageUrl);
      }

      if (dmConfig.footerGifUrl) {
        embed.setImage(dmConfig.footerGifUrl);
      }

      await member.send({ embeds: [embed] });
    } catch (dmError) {
      console.error(`Could not send welcome DM to ${member.user.tag}: ${dmError.message}`);
    }

    // Assign role if configured
    if (config.welcomer.roleId) {
      const role = await member.guild.roles.fetch(config.welcomer.roleId);
      if (role) {
        await member.roles.add(role);
      }
    }
  } catch (error) {
    console.error('Error in welcomer:', error);
  }
}
