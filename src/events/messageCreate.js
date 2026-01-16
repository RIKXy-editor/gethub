import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
}
