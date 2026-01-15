import { EmbedBuilder } from 'discord.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  if (member.user.bot) return;

  // Configuration - Can be made dynamic later
  const WELCOME_CHANNEL_NAME = 'welcome';
  const WELCOME_COLOR = '#9b59b6'; // Purple matching /embade
  const THUMBNAIL_URL = 'https://images-ext-1.discordapp.net/external/IXixxPzgrGuQiFTO4n8yFxRDKB57TPVs4WbTLJINJO8/https/i.ibb.co/QFvjjCv8/ezgif-3bb603bd9474c7.gif';

  const channel = member.guild.channels.cache.find(ch => ch.name === WELCOME_CHANNEL_NAME);
  if (!channel) return;

  const memberCount = member.guild.memberCount;

  const embed = new EmbedBuilder()
    .setTitle('👋 Welcome to Editors Club!')
    .setDescription(`Welcome ${member} to the server!\n\nYou are our **${memberCount}** member. We are glad to have you here!`)
    .setColor(WELCOME_COLOR)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setImage(THUMBNAIL_URL)
    .setFooter({ text: `Member #${memberCount} • Editors Club` })
    .setTimestamp();

  try {
    await channel.send({ content: `Hey ${member}, welcome!`, embeds: [embed] });
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}
