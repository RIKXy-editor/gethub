import { EmbedBuilder } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  if (member.user.bot) return;

  // ================= CONFIGURATION =================
  const WELCOME_CHANNEL_NAME = 'welcome'; 
  const RESOURCE_CHANNEL_NAME = 'resource';
  const THUMBNAIL_IMAGE_URL = 'https://media.discordapp.net/attachments/1322234972559016016/1325792437653241856/Untitled_design_6.png'; // User should replace this
  const BANNER_IMAGE_URL = 'https://media.discordapp.net/attachments/1322234972559016016/1325792437653241856/Untitled_design_6.png'; // User should replace this
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
