import { EmbedBuilder } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  if (member.user.bot) return;

  // ================= CONFIGURATION =================
  const WELCOME_CHANNEL_NAME = 'welcome'; 
  const RESOURCE_CHANNEL_NAME = 'resource';
  const THUMBNAIL_IMAGE_URL = 'https://images-ext-1.discordapp.net/external/IXixxPzgrGuQiFTO4n8yFxRDKB57TPVs4WbTLJINJO8/https/i.ibb.co/QFvjjCv8/ezgif-3bb603bd9474c7.gif?width=400&height=225'; 
  const BANNER_IMAGE_URL = 'https://images-ext-1.discordapp.net/external/IXixxPzgrGuQiFTO4n8yFxRDKB57TPVs4WbTLJINJO8/https/i.ibb.co/QFvjjCv8/ezgif-3bb603bd9474c7.gif?width=400&height=225'; 
  // =================================================

  const channel = member.guild.channels.cache.find(ch => ch.name === WELCOME_CHANNEL_NAME);
  if (!channel) return;

  const resourceChannel = member.guild.channels.cache.find(ch => ch.name === RESOURCE_CHANNEL_NAME);
  const resourceMention = resourceChannel ? `<#${resourceChannel.id}>` : '#resource';

  const memberCount = member.guild.memberCount;

  // 1. Send normal text message
  await channel.send(`Hey ${member}, Welcome to Editor’s Club! You are #${memberCount} to join us.`);

  // 2. Send embed message
  const welcomeEmbed = new EmbedBuilder()
    .setColor('#8B0000') // Dark Red
    .setTitle(`Hey ${member.user.username}, Welcome to Editors Club !!`)
    .setDescription(`Get your Assets - ${resourceMention}`)
    .setThumbnail(THUMBNAIL_IMAGE_URL)
    .setImage(BANNER_IMAGE_URL)
    .setFooter({ text: 'Editor’s Club • Stay active' })
    .setTimestamp();

  try {
    await channel.send({ embeds: [welcomeEmbed] });
  } catch (error) {
    console.error('Error in welcome system:', error);
  }
}
