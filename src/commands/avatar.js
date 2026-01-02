import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription("Display a user's avatar and banner")
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to get the avatar from')
      .setRequired(false));

export async function execute(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  
  // Fetch full user to get banner
  const fullUser = await interaction.client.users.fetch(user.id, { force: true });
  
  const avatarURL = fullUser.displayAvatarURL({ dynamic: true, size: 4096 });
  const bannerURL = fullUser.bannerURL({ dynamic: true, size: 4096 });

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🖼️ Avatar Enhancer - ${fullUser.username}`)
    .setImage(avatarURL)
    .setTimestamp();

  const buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Download Avatar')
        .setURL(avatarURL)
        .setStyle(ButtonStyle.Link)
    );

  if (bannerURL) {
    embed.addFields({ name: '✨ Profile Banner', value: 'See the banner below (if applicable) or click the button.' });
    buttons.addComponents(
      new ButtonBuilder()
        .setLabel('Download Banner')
        .setURL(bannerURL)
        .setStyle(ButtonStyle.Link)
    );
    // Note: Embeds can only have one large image. We'll stick to Avatar as primary.
  }

  await interaction.reply({ embeds: [embed], components: [buttons] });
}
