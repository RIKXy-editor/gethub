import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setJobConfig } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('jobconfig')
  .setDescription('Configure job posting system (Admin only)')
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Job posting channel')
      .setRequired(true)
  )
  .addRoleOption(option =>
    option
      .setName('role')
      .setDescription('Role required to post jobs (optional)')
      .setRequired(false)
  )
  .addIntegerOption(option =>
    option
      .setName('cooldown')
      .setDescription('Cooldown between job posts in minutes (default: 5)')
      .setMinValue(1)
      .setMaxValue(60)
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true
    });
    return;
  }

  const channel = interaction.options.getChannel('channel');
  const role = interaction.options.getRole('role');
  const cooldown = interaction.options.getInteger('cooldown') ?? 5;

  setJobConfig(GUILD_ID, {
    channelId: channel.id,
    roleId: role?.id || null,
    cooldownMinutes: cooldown
  });

  await interaction.reply({
    content: `✅ Job posting configured!\n- Channel: ${channel}\n- Role: ${role ? role.toString() : 'None (anyone can post)'}\n- Cooldown: ${cooldown} minutes`,
    ephemeral: true
  });
}
