import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lockdownPath = path.join(__dirname, '../../data/lockdown.json');

export const data = new SlashCommandBuilder()
  .setName('lockdown')
  .setDescription('Admin-only Server Lockdown system')
  .addSubcommand(sub =>
    sub.setName('enable')
      .setDescription('Lock/hide the entire server')
      .addChannelOption(opt => opt.setName('channel1').setDescription('First visible channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
      .addChannelOption(opt => opt.setName('channel2').setDescription('Second visible channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
      .addChannelOption(opt => opt.setName('channel3').setDescription('Third visible channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
  )
  .addSubcommand(sub =>
    sub.setName('disable')
      .setDescription('Restore the server permissions')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guild = interaction.guild;

  if (subcommand === 'enable') {
    await interaction.deferReply({ ephemeral: true });
    
    const visibleChannels = [
      interaction.options.getChannel('channel1')?.id,
      interaction.options.getChannel('channel2')?.id,
      interaction.options.getChannel('channel3')?.id
    ].filter(Boolean);

    const backup = {};
    const channels = await guild.channels.fetch();

    let processed = 0;
    const total = channels.size;

    for (const [id, channel] of channels) {
      if (!channel) continue;
      
      // Backup current @everyone overwrites
      const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      backup[id] = everyoneOverwrite ? {
        allow: everyoneOverwrite.allow.bitfield.toString(),
        deny: everyoneOverwrite.deny.bitfield.toString()
      } : null;

      // Apply lockdown permissions
      const isVisible = visibleChannels.includes(id);
      
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          ViewChannel: isVisible ? true : false,
          SendMessages: false,
          AddReactions: false,
          Connect: false,
          Speak: false
        });
      } catch (err) {
        console.error(`Failed to lock channel ${channel.name}:`, err);
      }
      
      processed++;
      if (processed % 10 === 0) {
        await interaction.editReply(`🔒 Locking server... (${processed}/${total} channels)`);
      }
    }

    fs.writeFileSync(lockdownPath, JSON.stringify(backup, null, 2));
    await interaction.editReply(`✅ **Lockdown Enabled.** Server is now hidden for everyone except the ${visibleChannels.length} selected channels.`);
  }

  if (subcommand === 'disable') {
    await interaction.deferReply({ ephemeral: true });

    if (!fs.existsSync(lockdownPath)) {
      return await interaction.editReply('❌ No lockdown backup found.');
    }

    const backup = JSON.parse(fs.readFileSync(lockdownPath, 'utf8'));
    const channels = await guild.channels.fetch();

    let processed = 0;
    const total = Object.keys(backup).length;

    for (const [id, originalState] of Object.entries(backup)) {
      const channel = channels.get(id);
      if (!channel) continue;

      try {
        if (originalState === null) {
          // If there was no overwrite, remove the current one
          await channel.permissionOverwrites.delete(guild.roles.everyone);
        } else {
          // Restore original bitfields
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            ViewChannel: (BigInt(originalState.allow) & PermissionFlagsBits.ViewChannel) !== 0n ? true : (BigInt(originalState.deny) & PermissionFlagsBits.ViewChannel) !== 0n ? false : null,
            // For simple restoration, we just put back the allow/deny bitfields
          });
          // Direct bitfield edit is cleaner for restoration
          await channel.permissionOverwrites.set([
            {
              id: guild.roles.everyone.id,
              allow: BigInt(originalState.allow),
              deny: BigInt(originalState.deny)
            }
          ]);
        }
      } catch (err) {
        console.error(`Failed to restore channel ${channel.name}:`, err);
      }

      processed++;
      if (processed % 10 === 0) {
        await interaction.editReply(`🔓 Restoring server... (${processed}/${total} channels)`);
      }
    }

    fs.unlinkSync(lockdownPath);
    await interaction.editReply('✅ **Server Restored.** Original permissions have been applied to all channels.');
  }
}
