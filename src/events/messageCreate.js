import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statsPath = path.join(__dirname, '../../data/user-stats.json');

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

  if (!stats[guildId]) stats[guildId] = {};
  if (!stats[guildId][userId]) stats[guildId][userId] = { messageCount: 0 };

  stats[guildId][userId].messageCount = (stats[guildId][userId].messageCount || 0) + 1;
  
  saveStats(stats);
}
