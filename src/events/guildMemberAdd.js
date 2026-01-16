import { EmbedBuilder } from 'discord.js';
import { getWelcomeConfig } from '../utils/storage.js';

export const name = 'guildMemberAdd';
export const once = false;

function replacePlaceholders(text, member) {
  if (!text) return '';
  return text
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString());
}

function buildWelcomeEmbed(config, member) {
  const embed = new EmbedBuilder()
    .setTitle(replacePlaceholders(config.title, member))
    .setDescription(replacePlaceholders(config.description, member))
    .setColor(config.color || '#9b59b6')
    .setTimestamp();

  if (config.footer) {
    embed.setFooter({ text: replacePlaceholders(config.footer, member) });
  }

  if (config.thumbnailMode === 'user') {
    embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
  } else if (config.thumbnailMode === 'server') {
    embed.setThumbnail(member.guild.iconURL({ dynamic: true }));
  }

  if (config.imageUrl) {
    embed.setImage(config.imageUrl);
  }

  return embed;
}

export async function execute(member) {
  if (member.user.bot) return;

  const config = getWelcomeConfig(member.guild.id);
  
  if (!config.enabled || !config.channelId) return;

  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel) return;

  const embed = buildWelcomeEmbed(config, member);

  try {
    const content = config.pingUser ? `${member}` : null;
    await channel.send({ content, embeds: [embed] });
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }

  if (config.dmWelcome) {
    try {
      await member.send({ embeds: [embed] });
    } catch (error) {
      console.error('Could not DM user:', error.message);
    }
  }

  if (config.autoRoleId) {
    try {
      const role = member.guild.roles.cache.get(config.autoRoleId);
      if (role) {
        await member.roles.add(role);
      }
    } catch (error) {
      console.error('Could not assign auto role:', error.message);
    }
  }
}
