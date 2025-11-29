import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Send a reminder DM to a user about their open ticket')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to remind')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('ticket')
      .setDescription('Ticket number or description')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Optional custom message to include')
      .setRequired(false)
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({
      content: '❌ This bot is private and can only be used in the authorized server.',
      ephemeral: true
    });
    console.log(`Unauthorized access attempt from guild ${interaction.guildId} by user ${interaction.user.tag}`);
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const ticketInfo = interaction.options.getString('ticket');
  const customMessage = interaction.options.getString('message');

  try {
    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('🎫 Ticket Reminder')
      .setDescription('This is a friendly reminder about your open ticket.')
      .addFields(
        { name: 'Ticket', value: ticketInfo, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Reminder sent by ${interaction.user.tag}` });

    if (customMessage) {
      embed.addFields({ name: 'Additional Message', value: customMessage, inline: false });
    }

    await targetUser.send({ embeds: [embed] });

    await interaction.reply({
      content: `✅ Successfully sent a reminder to ${targetUser.tag} about ticket: ${ticketInfo}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error sending DM:', error);
    
    await interaction.reply({
      content: `❌ Failed to send DM to ${targetUser.tag}. They may have DMs disabled or have blocked the bot.`,
      ephemeral: true
    });
  }
}
