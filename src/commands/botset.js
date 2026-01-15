import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('botset')
  .setDescription('Change the bot profile picture or banner')
  .addSubcommand(sub =>
    sub.setName('avatar')
      .setDescription('Change the bot profile picture')
      .addStringOption(opt => opt.setName('url').setDescription('Image URL for the avatar').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('banner')
      .setDescription('Change the bot banner')
      .addStringOption(opt => opt.setName('url').setDescription('Image/GIF URL for the banner').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('description')
      .setDescription('Change the bot "About Me" description')
      .addStringOption(opt => opt.setName('text').setDescription('The new description text').setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  await interaction.deferReply({ ephemeral: true });

  try {
    if (subcommand === 'avatar') {
      const url = interaction.options.getString('url');
      await interaction.client.user.setAvatar(url);
      await interaction.editReply({ content: '✅ Bot avatar updated successfully!' });
    } else if (subcommand === 'banner') {
      const url = interaction.options.getString('url');
      await interaction.client.user.setBanner(url);
      await interaction.editReply({ content: '✅ Bot banner updated successfully!' });
    } else if (subcommand === 'description') {
      const text = interaction.options.getString('text');
      await interaction.client.user.setAboutMe(text);
      await interaction.editReply({ content: '✅ Bot description updated successfully!' });
    }
  } catch (error) {
    console.error(`Error updating bot ${subcommand}:`, error);
    let errorMsg = `❌ Failed to update ${subcommand}.`;
    if (subcommand === 'banner') errorMsg += ' Make sure the bot has Nitro.';
    if (subcommand === 'description') errorMsg += ' Note: This updates the "About Me" section.';
    
    await interaction.editReply({ content: errorMsg });
  }
}
