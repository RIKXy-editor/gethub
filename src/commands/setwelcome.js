import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getWelcomeText, setWelcomeText } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('setwelcome')
  .setDescription('Set custom welcome message text (admin only)')
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

  await interaction.reply({
    content: `Send the new welcome description text now.\nIt can be multi-line.\nType \`cancel\` to stop.\n\nAvailable placeholders:\n- \`{user}\` - member mention/username\n- \`{server}\` - server name\n- \`{member_count}\` - total members`,
    ephemeral: true
  });

  const collectorFilter = msg => msg.author.id === interaction.user.id && msg.channelId === interaction.channelId;

  try {
    const collected = await interaction.channel.awaitMessages({ filter: collectorFilter, max: 1, time: 120000 });
    
    if (collected.size === 0) {
      await interaction.followUp({ content: '⏱️ Timed out. Welcome text not updated.', ephemeral: true });
      return;
    }

    const message = collected.first();
    const text = message.content.trim();

    if (text.toLowerCase() === 'cancel') {
      await interaction.followUp({ content: '❌ Cancelled. Welcome text not updated.', ephemeral: true });
      await message.delete().catch(() => null);
      return;
    }

    setWelcomeText(GUILD_ID, text);
    await interaction.followUp({ content: '✅ Welcome text updated!', ephemeral: true });
    await message.delete().catch(() => null);
  } catch (error) {
    console.error('Error in setwelcome:', error);
    await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true }).catch(() => null);
  }
}
