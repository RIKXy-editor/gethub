import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder } from 'discord.js';
import pg from 'pg';

const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statsPath = path.join(__dirname, '../../data/user-stats.json');

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function loadStats() {
  try {
    if (!fs.existsSync(statsPath)) return {};
    return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  } catch (err) {
    console.error('Error loading user stats:', err);
    return {};
  }
}

function saveStats(stats) {
  try {
    const dataDir = path.dirname(statsPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('Error saving user stats:', err);
  }
}

export const name = 'messageCreate';
export const once = false;

export async function execute(message) {
  if (message.author.bot || !message.guildId) return;

  const stats = loadStats();
  const guildId = message.guildId;
  const userId = message.author.id;
  const now = new Date();
  const weekKey = `${now.getFullYear()}-W${getWeekNumber(now)}`;

  if (!stats[guildId]) stats[guildId] = {};
  if (!stats[guildId][userId]) stats[guildId][userId] = { messageCount: 0, weekly: {} };
  
  // Initialize weekly if missing (migration)
  if (!stats[guildId][userId].weekly) stats[guildId][userId].weekly = {};

  stats[guildId][userId].messageCount = (stats[guildId][userId].messageCount || 0) + 1;
  stats[guildId][userId].weekly[weekKey] = (stats[guildId][userId].weekly[weekKey] || 0) + 1;
  
  saveStats(stats);

  // Keyword Warning System
  const guildId_str = message.guildId;
  const settings = await db.query('SELECT enabled FROM keyword_settings WHERE guild_id = $1', [guildId_str]);
  
  if (settings.rows[0]?.enabled) {
    const keywordsRes = await db.query('SELECT keyword FROM keywords WHERE guild_id = $1', [guildId_str]);
    const keywords = keywordsRes.rows.map(r => r.keyword);
    
    const content = message.content.toLowerCase();
    const found = keywords.find(k => content.includes(k.toLowerCase()));

    if (found) {
      const warnEmbed = new EmbedBuilder()
        .setTitle('⚠️ WARNING / NOTICE')
        .setDescription('This server does NOT allow sharing cracked plugins, pirated software, keygens, or illegal downloads.\nIf anyone is caught doing this, they will face strict action (mute/kick/ban) without warning.')
        .setColor('#FF0000');

      await message.reply({
        content: `${message.author}`,
        embeds: [warnEmbed]
      });
    }
  }
}
