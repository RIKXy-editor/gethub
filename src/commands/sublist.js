import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import db from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('sublist')
  .setDescription('List all active subscriptions (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subs = db.prepare('SELECT * FROM subscriptions WHERE active = 1').all();

  if (subs.length === 0) {
    return interaction.reply({ content: 'No active subscriptions found.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('Active Adobe Subscriptions')
    .setColor('#0099ff')
    .setTimestamp();

  const now = new Date();
  
  subs.forEach(sub => {
    const endDate = new Date(sub.end_date + 'T00:00:00Z');
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    embed.addFields({
      name: `User: <@${sub.user_id}>`,
      value: `**Plan:** ${sub.plan}\n**End Date:** ${sub.end_date}\n**Days Left:** ${diffDays > 0 ? diffDays : 'Expired'}`,
      inline: false
    });
  });

  await interaction.reply({ embeds: [embed] });
}
