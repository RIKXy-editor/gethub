import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../utils/storage.js';
import { COLORS, GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('welcomer')
  .setDescription('Configure the automatic welcomer system')
  .addSubcommand(sub =>
    sub
      .setName('setup')
      .setDescription('Set up welcome messages for new members')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel for welcome message').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Welcome message text').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('Role to assign on join (optional)').setRequired(false))
  )
  .addSubcommand(sub =>
    sub
      .setName('disable')
      .setDescription('Disable the welcomer system')
  );

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'setup') {
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const role = interaction.options.getRole('role');

    setGuildConfig(GUILD_ID, {
      welcomer: {
        enabled: true,
        channelId: channel.id,
        message: message,
        roleId: role?.id || null
      }
    });

    await interaction.reply({
      content: `✅ Welcomer configured! New members will receive: "${message}" in ${channel}${role ? ` and be assigned ${role}` : ''}`,
      ephemeral: true
    });
  } else if (subcommand === 'disable') {
    setGuildConfig(GUILD_ID, { welcomer: { enabled: false } });
    await interaction.reply({
      content: '✅ Welcomer disabled',
      ephemeral: true
    });
  }
}
