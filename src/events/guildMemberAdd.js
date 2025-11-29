import { getGuildConfig, getWelcomeText } from '../utils/storage.js';

export const name = 'guildMemberAdd';

export async function execute(member) {
  const config = getGuildConfig(member.guild.id);
  
  if (!config.welcomer || !config.welcomer.enabled) return;

  try {
    const channel = await member.guild.channels.fetch(config.welcomer.channelId);
    if (channel) {
      const welcomeTemplate = getWelcomeText(member.guild.id);
      
      // Replace placeholders
      let welcomeText = welcomeTemplate
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{server}/g, member.guild.name)
        .replace(/{member_count}/g, member.guild.memberCount);
      
      await channel.send(`<@${member.id}> ${welcomeText}`);
    }

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
