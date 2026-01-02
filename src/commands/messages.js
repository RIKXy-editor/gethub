import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statsPath = path.join(__dirname, '../../data/user-stats.json');

export const data = new SlashCommandBuilder()
  .setName('messages')
  .setDescription('Show total message count for a user')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to check')
      .setRequired(false));

export async function execute(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  
  let stats = {};
  try {
    if (fs.existsSync(statsPath)) {
      stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading stats:', err);
  }

  const guildId = interaction.guildId;
  const userId = user.id;
  const count = stats[guildId]?.[userId]?.messageCount || 0;

  const embed = new EmbedBuilder()
    .setColor('#00ff99')
    .setTitle(`✉️ Message Count`)
    .setDescription(`${user.toString()} has sent **${count.toLocaleString()}** messages in this server since tracking started.`)
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
