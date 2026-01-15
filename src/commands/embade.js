import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('embade')
  .setDescription('Build and post a custom embed')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  await interaction.reply({
    content: '📝 **Let\'s build your embed!**\n\nWhat is the **Title**? (Type \'cancel\' to stop)',
    ephemeral: true
  });

  const filter = m => m.author.id === interaction.user.id && m.channelId === interaction.channelId;
  const collectorOptions = { filter, max: 1, time: 300000, errors: ['time'] };

  let title = 'No Title';
  let context = 'No Context';
  let header = null;
  let thumb = null;
  let banner = null;
  let color = 0x9b59b6;

  const buildEmbed = () => {
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
    return embed;
  };

  try {
    // 1. Collect Title
    const titleMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (titleMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, titleMsg);
    title = titleMsg.content;
    await titleMsg.delete().catch(() => null);

    // 2. Collect Description/Context
    await interaction.editReply({
      content: '📝 **What is the Context/Description?** (Can be multi-line)',
      embeds: [buildEmbed()]
    });
    const contextMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (contextMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, contextMsg);
    context = contextMsg.content;
    await contextMsg.delete().catch(() => null);

    // 3. Collect Header URL
    await interaction.editReply({
      content: '📝 **Enter Header Image URL** (or type \'skip\')',
      embeds: [buildEmbed()]
    });
    const headerMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (headerMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, headerMsg);
    header = headerMsg.content.toLowerCase() === 'skip' ? null : headerMsg.content;
    await headerMsg.delete().catch(() => null);

    // 4. Collect Thumbnail URL
    await interaction.editReply({
      content: '📝 **Enter Thumbnail Image URL** (or type \'skip\')',
      embeds: [buildEmbed()]
    });
    const thumbMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (thumbMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, thumbMsg);
    thumb = thumbMsg.content.toLowerCase() === 'skip' ? null : thumbMsg.content;
    await thumbMsg.delete().catch(() => null);

    // 5. Collect Banner URL
    await interaction.editReply({
      content: '📝 **Enter Banner Image/GIF URL** (or type \'skip\')',
      embeds: [buildEmbed()]
    });
    const bannerMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (bannerMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, bannerMsg);
    banner = bannerMsg.content.toLowerCase() === 'skip' ? null : bannerMsg.content;
    await bannerMsg.delete().catch(() => null);

    // 6. Collect Color
    await interaction.editReply({
      content: '📝 **Enter Embed Color (Hex Code, e.g., #FF0000)** (or type \'skip\')',
      embeds: [buildEmbed()]
    });
    const colorMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (colorMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, colorMsg);
    if (colorMsg.content.toLowerCase() !== 'skip') {
      const hexColor = colorMsg.content.startsWith('#') ? colorMsg.content : `#${colorMsg.content}`;
      if (/^#[0-9A-F]{6}$/i.test(hexColor)) {
        color = parseInt(hexColor.replace('#', ''), 16);
      }
    }
    await colorMsg.delete().catch(() => null);

    const previewRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('embade_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('embade_edit').setLabel('Edit').setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '✅ **Preview ready.** Click confirm to proceed or edit to rebuild.',
      embeds: [buildEmbed()],
      components: [previewRow]
    });

  } catch (error) {
    console.error('Embade prompt error:', error);
    await interaction.editReply({
      content: '⏱️ **Timed out or an error occurred.** Please run `/embade` again.',
      embeds: []
    }).catch(() => null);
  }
}

async function cancel(interaction, msg) {
  await msg.delete().catch(() => null);
  await interaction.editReply('❌ **Cancelled.**');
}
