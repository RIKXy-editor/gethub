import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Display information about a user')
  .addUserOption(option => 
    option.setName('user')
      .setDescription('The user to get info about')
      .setRequired(false));

export async function execute(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle(`User Info - ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: 'Username', value: user.tag, inline: true },
      { name: 'User ID', value: user.id, inline: true },
      { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false }
    );

  if (member) {
    const roles = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => role.toString())
      .join(', ') || 'None';

    embed.addFields(
      { name: 'Server Nickname', value: member.nickname || 'None', inline: true },
      { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
      { name: 'Roles', value: roles, inline: false }
    );
  } else {
    embed.setFooter({ text: 'User is not in this server' });
  }

  await interaction.reply({ embeds: [embed] });
}
