import { EmbedBuilder } from 'discord.js';

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  // ================= CONFIGURATION =================
  const WELCOME_CHANNEL_ID = '1322234972559016016'; // <--- WELCOME CHANNEL ID
  const RESOURCE_CHANNEL_ID = '1231862597720375357'; // <--- RESOURCE CHANNEL ID
  const BANNER_IMAGE_URL = 'https://media.discordapp.net/attachments/1322234972559016016/1325792437653241856/Untitled_design_6.png?ex=677ce098&is=677b8f18&hm=46892557343e5c9b1e311229a13944124c&'; // <--- BANNER IMAGE URL
  // =================================================

  // DM Welcome Message (Keeping as it was)
  const WELCOME_DM_MESSAGE = `**Welcome to Editor's Club :wave:**

You're now part of the community.

• Get your Adobe subscription for cheap - https://discord.com/channels/1153309880644554804/1415963231108861952

• Download assets, tools, and resources - https://discord.com/channels/1153309880644554804/1398375540158628031`;

  try {
    await member.send(WELCOME_DM_MESSAGE);
  } catch (err) {
    console.warn(`Could not DM ${member.user.tag}`);
  }

  // Channel Welcome Embed
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const joinPosition = member.guild.memberCount;

  const welcomeEmbed = new EmbedBuilder()
    .setColor('#FF0000') // Red theme
    .setTitle(`Hey ${member.user.username}, Welcome to Editors Club !!`)
    .setDescription(`Welcome to the server, ${member}! We're glad to have you here.\n\nMake sure to check out <#${RESOURCE_CHANNEL_ID}> for all the editing resources you need!\n\nYou are **#${joinPosition}** to join us!`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setImage(BANNER_IMAGE_URL)
    .setTimestamp()
    .setFooter({ text: 'Editors Club • Professional Editing Community', iconURL: member.guild.iconURL() });

  try {
    await channel.send({
      content: `Welcome ${member}! 🚀`,
      embeds: [welcomeEmbed]
    });
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}
