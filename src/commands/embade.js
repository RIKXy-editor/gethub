import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('embade')
  .setDescription('Build and post a custom embed')
  .addStringOption(option => 
    option.setName('title')
      .setDescription('Embed title')
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
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const title = interaction.options.getString('title');
  const header = interaction.options.getString('header');
  const thumb = interaction.options.getString('thumb');
  const banner = interaction.options.getString('banner');
  const type = 'default';

  await interaction.reply({
    content: `📝 **What is the context/description for the embed?**\nIt can be multi-line.\nType 'cancel' to stop.`,
    ephemeral: true
  });

  try {
    const filter = m => m.author.id === interaction.user.id && m.channelId === interaction.channelId;
    const collected = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 120000,
      errors: ['time']
    });

    const userMessage = collected.first();
    const context = userMessage.content;

    if (context.toLowerCase() === 'cancel') {
      await interaction.followUp({ content: '❌ Cancelled.', ephemeral: true });
      await userMessage.delete().catch(() => null);
      return;
    }

    await userMessage.delete().catch(() => null);

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

    if (header && banner) {
      embed.setThumbnail(header);
      embed.setImage(banner);
    } else if (header) {
      embed.setImage(header);
    } else if (banner) {
      embed.setImage(banner);
    }

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

    await interaction.followUp({
      content: '✅ **Preview ready.** Click confirm to proceed or edit to rebuild.',
      embeds: [embed],
      components: [previewRow],
      ephemeral: true
    });
  } catch (error) {
    if (error.message === 'Awaiting messages timed out after 120000ms') {
      await interaction.followUp({ content: '⏱️ Context prompt timed out. Please try again.', ephemeral: true });
    } else {
      console.error('Error in embade command:', error);
      await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
    }
  }
}
