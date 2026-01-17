import { EmbedBuilder } from 'discord.js';
import pg from 'pg';

const { Pool } = pg;
let pool = null;

if (process.env.DATABASE_URL) {
  const isInternalRailway = process.env.DATABASE_URL.includes('.railway.internal');
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: isInternalRailway ? false : { rejectUnauthorized: false }
  });
}

const defaultConfig = {
  enabled: false,
  channelId: null,
  title: 'Welcome to {server}!',
  description: 'Hey {user}, welcome to **{server}**!\nYou are our **{memberCount}** member.',
  footer: 'Member #{memberCount}',
  color: '#9b59b6',
  thumbnailMode: 'user',
  imageUrl: null,
  pingUser: true,
  dmWelcome: false,
  autoRoleId: null
};

async function getWelcomeConfig(guildId) {
  if (!pool) return { ...defaultConfig };
  try {
    const res = await pool.query('SELECT * FROM welcome_config WHERE guild_id = $1', [guildId]);
    if (res.rows[0]) {
      const row = res.rows[0];
      return {
        enabled: row.enabled,
        channelId: row.channel_id,
        title: row.title,
        description: row.description,
        footer: row.footer,
        color: row.color,
        thumbnailMode: row.thumbnail_mode,
        imageUrl: row.image_url,
        pingUser: row.ping_user,
        dmWelcome: row.dm_welcome,
        autoRoleId: row.auto_role_id
      };
    }
    return { ...defaultConfig };
  } catch (err) {
    console.error('Error getting welcome config:', err.message);
    return { ...defaultConfig };
  }
}

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

export const name = 'guildMemberAdd';
export const once = false;

export async function execute(member) {
  if (member.user.bot) return;

  const config = await getWelcomeConfig(member.guild.id);
  
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
