import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS, GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Send a plain text announcement to a channel')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Channel to send announcement to')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Your announcement message')
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option
      .setName('with-embed')
      .setDescription('Send as embedded message (default: plain text)')
      .setRequired(false)
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');
  const withEmbed = interaction.options.getBoolean('with-embed') ?? false;

  try {
    if (withEmbed) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setDescription(message)
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(message);
    }

    await interaction.reply({
      content: `✅ Announcement sent to ${channel}`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error sending announcement:', error);
    await interaction.reply({
      content: '❌ Failed to send announcement',
      ephemeral: true
    });
  }
}
