import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('embade')
  .setDescription('Build and post a custom embed')
  .addStringOption(option => 
    option.setName('title')
      .setDescription('Embed title')
      .setRequired(true))
  .addStringOption(option => 
    option.setName('context')
      .setDescription('Embed description/content')
      .setRequired(true))
  .addStringOption(option => 
    option.setName('header')
      .setDescription('Header image URL')
      .setRequired(false))
  .addStringOption(option => 
    option.setName('thumb')
      .setDescription('Thumbnail image URL')
      .setRequired(false))
  .addStringOption(option => 
    option.setName('banner')
      .setDescription('Banner image/GIF URL')
      .setRequired(false))
  .addStringOption(option => 
    option.setName('type')
      .setDescription('Type: announcement, info, warning, default')
      .setRequired(false)
      .addChoices(
        { name: 'Announcement', value: 'announcement' },
        { name: 'Info', value: 'info' },
        { name: 'Warning', value: 'warning' },
        { name: 'Default', value: 'default' }
      ))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const title = interaction.options.getString('title');
  const context = interaction.options.getString('context');
  const header = interaction.options.getString('header');
  const thumb = interaction.options.getString('thumb');
  const banner = interaction.options.getString('banner');
  const type = interaction.options.getString('type') || 'default';

  // Color logic
  const colors = {
    announcement: 0x2ecc71,
    warning: 0xe74c3c,
    info: 0x3498db,
    default: 0x9b59b6
  };
  const color = colors[type.toLowerCase()] || colors.default;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(context)
    .setColor(color)
    .setFooter({ text: 'Powered by /embade' });

  // Image Logic
  // If BOTH header and banner exist: header -> thumbnail, banner -> image
  // If ONLY header exists: header -> image
  // If ONLY banner exists: banner -> image
  if (header && banner) {
    embed.setThumbnail(header);
    embed.setImage(banner);
  } else if (header) {
    embed.setImage(header);
  } else if (banner) {
    embed.setImage(banner);
  }

  // Thumb option (if provided and thumbnail not already set by header)
  if (thumb && !embed.data.thumbnail) {
    embed.setThumbnail(thumb);
  }

  const previewRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('embade_confirm')
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('embade_edit')
      .setLabel('Edit')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: '✅ **Preview ready.** Click confirm to proceed or edit to rebuild.',
    embeds: [embed],
    components: [previewRow],
    ephemeral: true
  });
}
