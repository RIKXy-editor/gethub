import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('dm')
  .setDescription('Send a DM to all members with a specific role')
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('Role to target')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Message to send')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true
    });
    return;
  }

  const targetRole = interaction.options.getRole('role');
  const message = interaction.options.getString('message');

  await interaction.deferReply({ ephemeral: true });

  try {
    const members = await interaction.guild.members.fetch();
    const targetMembers = members.filter(m => m.roles.cache.has(targetRole.id) && !m.user.bot);

    if (targetMembers.size === 0) {
      await interaction.editReply(`No members found with role ${targetRole}`);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const failed = [];

    // Process in batches to avoid rate limiting
    for (const member of targetMembers.values()) {
      try {
        await member.user.send(message);
        successCount++;
      } catch (error) {
        failCount++;
        failed.push(`${member.user.tag}: ${error.message}`);
        console.log(`[DM Failed] ${member.user.tag} - ${error.message}`);
      }

      // Rate limit: 1 second between each DM
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const summary = `✅ Sent to ${successCount}/${targetMembers.size} members with role ${targetRole}`;
    const failedList = failed.length > 0 ? `\n\n⚠️ Failed (${failCount}): ${failed.slice(0, 5).join('\n')}${failed.length > 5 ? `\n... and ${failed.length - 5} more` : ''}` : '';

    await interaction.editReply(summary + failedList);
  } catch (error) {
    console.error('Error in bulk DM command:', error);
    await interaction.editReply('❌ An error occurred while sending DMs');
  }
}
