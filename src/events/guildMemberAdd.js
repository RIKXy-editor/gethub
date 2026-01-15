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

    const WELCOME_COLOR = '#9b59b6';
    const THUMBNAIL_URL = 'https://images-ext-1.discordapp.net/external/IXixxPzgrGuQiFTO4n8yFxRDKB57TPVs4WbTLJINJO8/https/i.ibb.co/QFvjjCv8/ezgif-3bb603bd9474c7.gif';
    const memberCount = member.guild.memberCount;

    const embed = new EmbedBuilder()
      .setTitle('👋 Welcome to Editors Club!')
      .setDescription(`Welcome ${member} to the server!\n\nYou are our **${memberCount}** member. We are glad to have you here!`)
      .setColor(WELCOME_COLOR)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage(THUMBNAIL_URL)
      .setFooter({ text: `Member #${memberCount} • Editors Club` })
      .setTimestamp();

    await channel.send({ content: `Hey ${member}, welcome!`, embeds: [embed] });
  } catch (error) {
    console.error('Error in welcome event:', error);
  } finally {
    await db.end().catch(() => null);
  }
}
