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
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const url = interaction.options.getString('url');

  await interaction.deferReply({ ephemeral: true });

  try {
    if (subcommand === 'avatar') {
      await interaction.client.user.setAvatar(url);
      await interaction.editReply({ content: '✅ Bot avatar updated successfully!' });
    } else if (subcommand === 'banner') {
      await interaction.client.user.setBanner(url);
      await interaction.editReply({ content: '✅ Bot banner updated successfully!' });
    }
  } catch (error) {
    console.error(`Error updating bot ${subcommand}:`, error);
    await interaction.editReply({ 
      content: `❌ Failed to update ${subcommand}. Make sure the URL is a valid image and the bot has Nitro if you are setting a banner.` 
    });
  }
}
