import { EmbedBuilder } from 'discord.js';
import pkg from 'pg';
const { Client } = pkg;

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  if (member.user.bot) return;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await db.connect();
    const res = await db.query('SELECT channel_id, enabled FROM welcome_settings WHERE guild_id = $1', [member.guild.id]);
    
    if (!res.rows[0] || !res.rows[0].enabled || !res.rows[0].channel_id) {
      return;
    }

    const channel = member.guild.channels.cache.get(res.rows[0].channel_id);
    if (!channel) return;

    const welcomeTitle = res.rows[0].title || '👋 Welcome to Editors Club!';
    const welcomeMessage = res.rows[0].message || 'Welcome {user} to the server!\n\nYou are our **{membercount}** member. We are glad to have you here!';
    const bannerUrl = res.rows[0].banner_url || 'https://images-ext-1.discordapp.net/external/IXixxPzgrGuQiFTO4n8yFxRDKB57TPVs4WbTLJINJO8/https/i.ibb.co/QFvjjCv8/ezgif-3bb603bd9474c7.gif';
    const WELCOME_COLOR = '#9b59b6';
    const memberCount = member.guild.memberCount;

    const replacePlaceholders = (text) => {
      return text
        .replace(/{user}/g, member.toString())
        .replace(/{membercount}/g, memberCount.toString())
        .replace(/{server}/g, member.guild.name)
        .replace(/{joindate}/g, member.joinedAt ? member.joinedAt.toLocaleDateString() : 'Unknown');
    };

    const embed = new EmbedBuilder()
      .setTitle(replacePlaceholders(welcomeTitle))
      .setDescription(replacePlaceholders(welcomeMessage))
      .setColor(WELCOME_COLOR)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage(bannerUrl)
      .setFooter({ text: `Member #${memberCount} • ${member.guild.name}` })
      .setTimestamp();

    await channel.send({ content: `Hey ${member}, welcome!`, embeds: [embed] });
  } catch (error) {
    console.error('Error in welcome event:', error);
  } finally {
    await db.end().catch(() => null);
  }
}
