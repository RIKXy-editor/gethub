import { SlashCommandBuilder } from 'discord.js';
import { addStickyMessage, removeStickyMessage } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('Create or remove a sticky message that reposts when chatted')
  .addSubcommand(sub =>
    sub
      .setName('create')
      .setDescription('Create a sticky message')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel for sticky message').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Message text').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('remove')
      .setDescription('Remove a sticky message')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to remove sticky from').setRequired(true))
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const channel = interaction.options.getChannel('channel');

  if (subcommand === 'create') {
    const message = interaction.options.getString('message');
    const sent = await channel.send(message);
    addStickyMessage(GUILD_ID, channel.id, sent.id, message);
    await interaction.reply({
      content: `✅ Sticky message created in ${channel}`,
      ephemeral: true
    });
  } else if (subcommand === 'remove') {
    removeStickyMessage(GUILD_ID, channel.id);
    await interaction.reply({
      content: `✅ Sticky message removed from ${channel}`,
      ephemeral: true
    });
  }
}
