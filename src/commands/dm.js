import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('dm')
  .setDescription('Send a DM to all members with a specific role (you will be prompted for the message)')
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('Role to target')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true
    });
    return;
  }

  const targetRole = interaction.options.getRole('role');

  await interaction.reply({
    content: `📝 What is the message content to send to all members with role ${targetRole}?\nIt can be multi-line.\nType 'cancel' to stop.`,
    ephemeral: true
  });

  try {
    const messageFilter = msg => msg.author.id === interaction.user.id && msg.channelId === interaction.channelId;
    const collected = await interaction.channel.awaitMessages({
      filter: messageFilter,
      max: 1,
      time: 120000,
      errors: ['time']
    });

    const userMessage = collected.first();

    if (userMessage.content.toLowerCase() === 'cancel') {
      await interaction.followUp({
        content: '❌ Cancelled.',
        ephemeral: true
      });
      await userMessage.delete().catch(() => null);
      return;
    }

    const messageContent = userMessage.content;
    await userMessage.delete().catch(() => null);

    await interaction.followUp({
      content: `📤 Sending this to all members with ${targetRole}…`,
      ephemeral: true
    });

    const members = await interaction.guild.members.fetch();
    const targetMembers = members.filter(m => m.roles.cache.has(targetRole.id) && !m.user.bot);

    if (targetMembers.size === 0) {
      await interaction.followUp({
        content: `⚠️ No members found with role ${targetRole}`,
        ephemeral: true
      });
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const failed = [];

    // Process in slow batches to avoid Discord anti-spam ban
    for (const member of targetMembers.values()) {
      try {
        await member.user.send(messageContent);
        successCount++;
        console.log(`[DM Success] Sent to ${member.user.tag} (${successCount}/${targetMembers.size})`);
      } catch (error) {
        failCount++;
        failed.push(`${member.user.tag}: ${error.message}`);
        console.log(`[DM Failed] ${member.user.tag} - ${error.message}`);
      }

      // SAFEST DELAY: 5-8 seconds randomized per user
      const safetyDelay = Math.floor(Math.random() * (8000 - 5000 + 1) + 5000);
      await new Promise(resolve => setTimeout(resolve, safetyDelay));
    }

    const summary = `✅ Sent to ${successCount}/${targetMembers.size} members with role ${targetRole}`;
    const failedList = failed.length > 0 ? `\n\n⚠️ Failed (${failCount}): ${failed.slice(0, 5).join('\n')}${failed.length > 5 ? `\n... and ${failed.length - 5} more` : ''}` : '';

    await interaction.followUp({
      content: summary + failedList,
      ephemeral: true
    });
  } catch (error) {
    if (error.code === 'INTERACTION_TOKEN_INVALID') {
      console.log('DM command timed out - interaction already responded');
    } else if (error.message === 'Awaiting messages timed out after 120000ms') {
      await interaction.followUp({
        content: '⏱️ Message prompt timed out. Please try again.',
        ephemeral: true
      }).catch(() => console.log('Could not send timeout message'));
    } else {
      console.error('Error in DM command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while sending DMs.',
        ephemeral: true
      }).catch(() => console.log('Could not send error message'));
    }
  }
}
