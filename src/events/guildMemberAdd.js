import { getGuildConfig, getWelcomeText } from '../utils/storage.js';

export const name = 'guildMemberAdd';

const WELCOME_DM_MESSAGE = `**Welcome to Editor's Club :wave:**

You're now part of the community.

• Get your Adobe subscription for cheap - https://discord.com/channels/1153309880644554804/1415963231108861952

• Download assets, tools, and resources - https://discord.com/channels/1153309880644554804/1398375540158628031`;

function replacePlaceholders(text, member) {
  return text
    .replace(/{user}/g, `<@${member.id}>`)
    .replace(/{server}/g, member.guild.name)
    .replace(/{member_count}/g, member.guild.memberCount);
}

export async function execute(member) {
  // Always send DM welcome message (automatic, no setup needed)
  try {
    await member.send(WELCOME_DM_MESSAGE);
    console.log(`Sent welcome DM to ${member.user.tag}`);
  } catch (dmError) {
    console.warn(`Could not send welcome DM to ${member.user.tag}: ${dmError.message}`);
  }

  // Handle channel welcome and role assignment (only if welcomer is configured)
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
