import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('botset')
  .setDescription('Change the bot profile picture, banner, or description')
  .addSubcommand(sub =>
    sub.setName('avatar')
      .setDescription('Change the bot profile picture')
  )
  .addSubcommand(sub =>
    sub.setName('banner')
      .setDescription('Change the bot banner')
  )
  .addSubcommand(sub =>
    sub.setName('description')
      .setDescription('Change the bot "About Me" description')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  
  // Defer first to avoid "Unknown Interaction" during collection
  await interaction.deferReply({ ephemeral: true });

  const filter = m => m.author.id === interaction.user.id && m.channelId === interaction.channelId;
  const collectorOptions = { filter, max: 1, time: 60000, errors: ['time'] };

  await interaction.editReply({ 
    content: `📝 **Let's update the bot ${subcommand}!**\n\nPlease type the new ${subcommand === 'description' ? 'description text' : 'image URL'} now. (Type 'cancel' to stop)`
  });

  try {
    const collected = await interaction.channel.awaitMessages(collectorOptions);
    const msg = collected.first();
    const input = msg.content;

    if (input.toLowerCase() === 'cancel') {
      await msg.delete().catch(() => null);
      return await interaction.editReply({ content: '❌ Update cancelled.' });
    }

    await interaction.editReply({ content: `⏳ Updating ${subcommand}...` });
    await msg.delete().catch(() => null);

    if (subcommand === 'avatar') {
      await interaction.client.user.setAvatar(input);
      await interaction.editReply({ content: '✅ Bot avatar updated successfully!' });
    } else if (subcommand === 'banner') {
      await interaction.client.user.setBanner(input);
      await interaction.editReply({ content: '✅ Bot banner updated successfully!' });
    } else if (subcommand === 'description') {
      // Use application.edit as it's the most reliable way to update bot "About Me"
      await interaction.client.application.edit({ description: input });
      await interaction.editReply({ content: '✅ Bot description updated successfully!' });
    }
  } catch (error) {
    console.error(`Error updating bot ${subcommand}:`, error);
    let errorMsg = `❌ Failed to update ${subcommand}.`;
    if (subcommand === 'banner') errorMsg += ' Make sure the bot has Nitro.';
    if (error.code === 50035) errorMsg += ' Invalid format or URL.';
    if (error.code === 50001) errorMsg += ' Missing Access (Permission issue).';
    
    await interaction.editReply({ content: errorMsg });
  }
}
