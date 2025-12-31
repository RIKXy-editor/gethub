import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Delete a specific number of messages from this channel')
  .addIntegerOption(option =>
    option
      .setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction) {
  try {
    const amount = interaction.options.getInteger('amount');

    // Check if bot has permission
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: '❌ I don\'t have permission to manage messages in this channel.',
        ephemeral: true
      });
      return;
    }

    // Fetch messages
    const messages = await interaction.channel.messages.fetch({ limit: amount });

    if (messages.size === 0) {
      await interaction.reply({
        content: '❌ No messages found to delete.',
        ephemeral: true
      });
      return;
    }

    // Filter out pinned messages and messages older than 14 days
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const messagesToDelete = messages.filter(msg => {
      const messageAge = now - msg.createdTimestamp;
      return !msg.pinned && messageAge < fourteenDaysMs;
    });

    if (messagesToDelete.size === 0) {
      await interaction.reply({
        content: '❌ No messages can be deleted (all are pinned or older than 14 days).',
        ephemeral: true
      });
      return;
    }

    // Delete messages
    await interaction.channel.bulkDelete(messagesToDelete, true);

    // Send confirmation message
    const confirmationMsg = await interaction.reply({
      content: `🧹 Deleted ${messagesToDelete.size} messages from this channel.`,
      ephemeral: false
    });

    // Auto-delete confirmation after 3 seconds
    setTimeout(async () => {
      try {
        await confirmationMsg.delete();
      } catch (error) {
        console.log('Confirmation message already deleted or unavailable');
      }
    }, 3000);

    console.log(`[CLEAR] ${interaction.user.tag} cleared ${messagesToDelete.size} messages in ${interaction.channel.name}`);

  } catch (error) {
    console.error('Error in /clear command:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: '❌ An error occurred while clearing messages.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: '❌ An error occurred while clearing messages.',
        ephemeral: true
      });
    }
  }
}
