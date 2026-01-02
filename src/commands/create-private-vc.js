import {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("create-private-vc")
  .setDescription("Create a private voice channel")
  .addUserOption(o => o.setName("user1").setDescription("User 1").setRequired(true))
  .addUserOption(o => o.setName("user2").setDescription("User 2").setRequired(false))
  .addUserOption(o => o.setName("user3").setDescription("User 3").setRequired(false));

export async function execute(interaction) {
  const member = interaction.member;

  if (!member.voice.channel) {
    return interaction.reply({
      content: "❌ You must be in a voice channel.",
      ephemeral: true
    });
  }

  const users = [
    interaction.user,
    interaction.options.getUser("user1"),
    interaction.options.getUser("user2"),
    interaction.options.getUser("user3")
  ].filter(Boolean);

  const uniqueUsers = [...new Map(users.map(u => [u.id, u])).values()];

  if (uniqueUsers.length > 3) {
    return interaction.reply({
      content: "❌ Max 3 users allowed.",
      ephemeral: true
    });
  }

  const overwrites = [
    {
      id: interaction.guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel]
    }
  ];

  uniqueUsers.forEach(user => {
    overwrites.push({
      id: user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.Connect
      ]
    });
  });

  interaction.guild.roles.cache
    .filter(r => r.permissions.has(PermissionsBitField.Flags.Administrator))
    .forEach(role => {
      overwrites.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.ViewChannel],
        deny: [PermissionsBitField.Flags.Connect]
      });
    });

  const vc = await interaction.guild.channels.create({
    name: `${interaction.user.username}'s VC`,
    type: ChannelType.GuildVoice,
    parent: member.voice.channel.parent,
    permissionOverwrites: overwrites
  });

  await interaction.reply({
    content: `✅ Private VC created: **${vc.name}**`,
    ephemeral: true
  });

  // AUTO DELETE WHEN EMPTY
  const interval = setInterval(async () => {
    try {
      const channel = await interaction.guild.channels.fetch(vc.id).catch(() => null);
      if (!channel || channel.members.size === 0) {
        if (channel) await channel.delete().catch(() => {});
        clearInterval(interval);
      }
    } catch (error) {
      clearInterval(interval);
    }
  }, 5000);
}
