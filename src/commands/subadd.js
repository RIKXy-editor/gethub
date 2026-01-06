import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import db from '../utils/database.js';

export const data = new SlashCommandBuilder()
  .setName('subadd')
  .setDescription('Add a new subscription (Admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(option => 
    option.setName('user').setDescription('The user to add the subscription to').setRequired(true))
  .addIntegerOption(option => 
    option.setName('plan').setDescription('Plan duration in months').setRequired(true)
    .addChoices(
      { name: '1 Month', value: 1 },
      { name: '3 Months', value: 3 },
      { name: '6 Months', value: 6 },
      { name: '12 Months', value: 12 },
    ))
  .addStringOption(option => 
    option.setName('start_date').setDescription('Start date in YYYY-MM-DD (UTC). Defaults to today.'));

export async function execute(interaction) {
  const user = interaction.options.getUser('user');
  const months = interaction.options.getInteger('plan');
  const startDateStr = interaction.options.getString('start_date');

  let startDate = startDateStr ? new Date(startDateStr + 'T00:00:00Z') : new Date();
  if (isNaN(startDate.getTime())) {
    return interaction.reply({ content: 'Invalid date format. Please use YYYY-MM-DD.', ephemeral: true });
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);

  const userId = user.id;
  const plan = `${months} Month${months > 1 ? 's' : ''}`;
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  try {
    db.prepare(`
      INSERT OR REPLACE INTO subscriptions (user_id, plan, start_date, end_date, next_reminder_date, active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, plan, startStr, endStr, startStr, 1);

    const embed = new EmbedBuilder()
      .setTitle('Subscription Added')
      .setColor('#00ff00')
      .addFields(
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'Plan', value: plan, inline: true },
        { name: 'Start Date', value: startStr, inline: true },
        { name: 'End Date', value: endStr, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Failed to save subscription to database.', ephemeral: true });
  }
}
