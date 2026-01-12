import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('feed')
  .setDescription('Send a review request')
  .addUserOption(option => 
    option.setName('user1')
      .setDescription('First user to request a review from')
      .setRequired(false))
  .addUserOption(option => 
    option.setName('user2')
      .setDescription('Second user to request a review from')
      .setRequired(false))
  .addUserOption(option => 
    option.setName('user3')
      .setDescription('Third user to request a review from')
      .setRequired(false))
  .addRoleOption(option => 
    option.setName('role')
      .setDescription('The role to request a review from')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const users = [
    interaction.options.getUser('user1'),
    interaction.options.getUser('user2'),
    interaction.options.getUser('user3')
  ].filter(u => u !== null);
  
  const targetRole = interaction.options.getRole('role');

  if (users.length === 0 && !targetRole) {
    return await interaction.reply({
      content: '❌ You must provide at least one user or a role to send a review request.',
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Thanks for purchasing Adobe subscription from us!')
    .setDescription('We’d love to hear your feedback. Click below to share a review ⭐')
    .setColor('Green')
    .setFooter({ text: 'Your feedback helps us improve.' });

  const button = new ButtonBuilder()
    .setCustomId('review_start')
    .setLabel('⭐ Share Review')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);

  let successCount = 0;
  let failCount = 0;

  await interaction.deferReply({ ephemeral: true });

  // Handle multiple specific users
  for (const user of users) {
    try {
      await user.send({
        embeds: [embed],
        components: [row]
      });
      successCount++;
      if (users.length > 1 || targetRole) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      failCount++;
    }
  }

  // Handle Role
  if (targetRole) {
    const members = await interaction.guild.members.fetch();
    const roleMembers = members.filter(member => member.roles.cache.has(targetRole.id) && !member.user.bot);
    
    for (const [id, member] of roleMembers) {
      // Skip if we already messaged them as an individual user
      if (users.some(u => u.id === id)) continue;

      try {
        await member.send({
          embeds: [embed],
          components: [row]
        });
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        failCount++;
      }
    }
  }

  await interaction.editReply({
    content: `✅ Sent review requests!\n- Successfully sent: ${successCount}\n- Failed (DMs closed): ${failCount}`
  });
}
