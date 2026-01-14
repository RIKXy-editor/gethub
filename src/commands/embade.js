import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('embade')
  .setDescription('Build and post a custom embed')
  .addStringOption(option => 
    option.setName('input')
      .setDescription('Format: title: TITLE | context: CONTEXT | header: URL | thumb: URL | banner: URL | type: TYPE')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const input = interaction.options.getString('input');
  
  // Parse input
  const parts = input.split('|').reduce((acc, part) => {
    const [key, ...value] = part.split(':');
    if (key && value) acc[key.trim().toLowerCase()] = value.join(':').trim();
    return acc;
  }, {});

  const title = parts.title || 'No Title';
  const context = parts.context || 'No Context';
  const header = parts.header || null;
  const thumb = parts.thumb || null;
  const banner = parts.banner || null;
  const type = parts.type || 'default';

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
