import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('feed')
  .setDescription('Send a review request')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to request a review from')
      .setRequired(false))
  .addRoleOption(option => 
    option.setName('role')
      .setDescription('The role to request a review from')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user');
  const targetRole = interaction.options.getRole('role');

  if (!targetUser && !targetRole) {
    return await interaction.reply({
      content: '❌ You must provide either a user or a role to send a review request.',
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

  if (targetUser) {
    try {
      await targetUser.send({
        embeds: [embed],
        components: [row]
      });
      successCount++;
    } catch (err) {
      failCount++;
    }
  }

  if (targetRole) {
    if (targetUser) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const members = await interaction.guild.members.fetch();
    const roleMembers = members.filter(member => member.roles.cache.has(targetRole.id) && !member.user.bot);
    
    for (const [id, member] of roleMembers) {
      if (targetUser && targetUser.id === id) continue;
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
