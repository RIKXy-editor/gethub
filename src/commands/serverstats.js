import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverstats')
  .setDescription('Display statistics for the server');

export async function execute(interaction) {
  const { guild } = interaction;
  
  // Fetch members to ensure accurate counts
  await guild.members.fetch();

  const totalMembers = guild.memberCount;
  const botCount = guild.members.cache.filter(member => member.user.bot).size;
  const humanCount = totalMembers - botCount;
  const boostCount = guild.premiumSubscriptionCount || 0;
  const boostLevel = guild.premiumTier;
  const creationDate = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;
  
  // Region is deprecated in newer discord.js versions (it's per-channel now), 
  // but we can show the preferred locale or verification level instead.
  const verificationLevel = guild.verificationLevel.toString();

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`📊 Server Stats - ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👥 Members', value: `${totalMembers.toLocaleString()} total\n(Humans: ${humanCount}, Bots: ${botCount})`, inline: true },
      { name: '🚀 Boosts', value: `Level ${boostLevel}\n(${boostCount} boosts)`, inline: true },
      { name: '📅 Created On', value: creationDate, inline: false },
      { name: '🛡️ Verification', value: verificationLevel, inline: true },
      { name: '🆔 Server ID', value: guild.id, inline: true }
    )
    .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
