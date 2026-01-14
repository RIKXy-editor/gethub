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
  const collectorOptions = { filter, max: 1, time: 60000, errors: ['time'] };

  try {
    // 1. Collect Title
    const titleMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (titleMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, titleMsg);
    const title = titleMsg.content;
    await titleMsg.delete().catch(() => null);

    // 2. Collect Description/Context
    await interaction.editReply('📝 **What is the Context/Description?** (Can be multi-line)');
    const contextMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (contextMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, contextMsg);
    const context = contextMsg.content;
    await contextMsg.delete().catch(() => null);

    // 3. Collect Header URL
    await interaction.editReply('📝 **Enter Header Image URL** (or type \'skip\')');
    const headerMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (headerMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, headerMsg);
    const header = headerMsg.content.toLowerCase() === 'skip' ? null : headerMsg.content;
    await headerMsg.delete().catch(() => null);

    // 4. Collect Thumbnail URL
    await interaction.editReply('📝 **Enter Thumbnail Image URL** (or type \'skip\')');
    const thumbMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (thumbMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, thumbMsg);
    const thumb = thumbMsg.content.toLowerCase() === 'skip' ? null : thumbMsg.content;
    await thumbMsg.delete().catch(() => null);

    // 5. Collect Banner URL
    await interaction.editReply('📝 **Enter Banner Image/GIF URL** (or type \'skip\')');
    const bannerMsg = (await interaction.channel.awaitMessages(collectorOptions)).first();
    if (bannerMsg.content.toLowerCase() === 'cancel') return await cancel(interaction, bannerMsg);
    const banner = bannerMsg.content.toLowerCase() === 'skip' ? null : bannerMsg.content;
    await bannerMsg.delete().catch(() => null);

    // Build the embed
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(context)
      .setColor(0x9b59b6)
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
      new ButtonBuilder().setCustomId('embade_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('embade_edit').setLabel('Edit').setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: '✅ **Preview ready.** Click confirm to proceed or edit to rebuild.',
      embeds: [embed],
      components: [previewRow]
    });

  } catch (error) {
    console.error('Embade prompt error:', error);
    await interaction.editReply('⏱️ **Timed out or an error occurred.** Please run `/embade` again.').catch(() => null);
  }
}

async function cancel(interaction, msg) {
  await msg.delete().catch(() => null);
  await interaction.editReply('❌ **Cancelled.**');
}
