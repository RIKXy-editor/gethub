import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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

export const data = new SlashCommandBuilder()
  .setName('active')
  .setDescription('Show the most active members this week');

export async function execute(interaction) {
  let stats = {};
  try {
    if (fs.existsSync(statsPath)) {
      stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading stats:', err);
  }

  const guildId = interaction.guildId;
  const now = new Date();
  const weekKey = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  const guildStats = stats[guildId] || {};

  const leaderboard = Object.entries(guildStats)
    .map(([userId, data]) => ({
      userId,
      count: data.weekly?.[weekKey] || 0
    }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 Weekly Activity Leaderboard')
    .setDescription(`Most active members for week ${weekKey}`)
    .setTimestamp();

  if (leaderboard.length === 0) {
    embed.setDescription('No activity recorded yet for this week.');
  } else {
    const list = leaderboard.map((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} <@${entry.userId}> - **${entry.count.toLocaleString()}** messages`;
    }).join('\n');
    embed.addFields({ name: 'Top Members', value: list });
  }

  await interaction.reply({ embeds: [embed] });
}
