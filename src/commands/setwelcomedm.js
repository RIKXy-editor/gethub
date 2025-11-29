import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setWelcomeDmTitle, setWelcomeDmDescription, setWelcomeDmThumbnail, setWelcomeDmImage, setWelcomeDmFooterGif } from '../utils/storage.js';
import { GUILD_ID } from '../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('setwelcomedm')
  .setDescription('Configure welcome DM embed for new members (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('title')
      .setDescription('Set the DM embed title')
  )
  .addSubcommand(sub =>
    sub
      .setName('description')
      .setDescription('Set the DM embed description')
  )
  .addSubcommand(sub =>
    sub
      .setName('thumbnail')
      .setDescription('Set the DM embed thumbnail URL')
  )
  .addSubcommand(sub =>
    sub
      .setName('image')
      .setDescription('Set the DM embed image URL')
  )
  .addSubcommand(sub =>
    sub
      .setName('footergif')
      .setDescription('Set the DM embed footer GIF URL')
  );

async function collectText(interaction, title, timeout = 120000) {
  const subcommand = interaction.options.getSubcommand();
  
  await interaction.reply({
    content: `Send the new ${title} now.\nIt can be multi-line.\nType \`cancel\` to stop.\n\nAvailable placeholders:\n- \`{user}\` - member mention/username\n- \`{server}\` - server name\n- \`{member_count}\` - total members`,
    ephemeral: true
  });

  const collectorFilter = msg => msg.author.id === interaction.user.id && msg.channelId === interaction.channelId;

  try {
    const collected = await interaction.channel.awaitMessages({ filter: collectorFilter, max: 1, time: timeout });
    
    if (collected.size === 0) {
      await interaction.followUp({ content: `⏱️ Timed out. ${title} not updated.`, ephemeral: true });
      return null;
    }

    const message = collected.first();
    const text = message.content.trim();

    if (text.toLowerCase() === 'cancel') {
      await interaction.followUp({ content: `❌ Cancelled. ${title} not updated.`, ephemeral: true });
      await message.delete().catch(() => null);
      return null;
    }

    await message.delete().catch(() => null);
    return text;
  } catch (error) {
    console.error('Error collecting text:', error);
    await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true }).catch(() => null);
    return null;
  }
}

export async function execute(interaction) {
  if (interaction.guildId !== GUILD_ID) {
    await interaction.reply({ content: '❌ This command can only be used in the authorized server.', ephemeral: true });
    return;
  }

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator) && interaction.user.id !== interaction.guild.ownerId) {
    await interaction.reply({
      content: '❌ You need Administrator permission to use this command.',
      ephemeral: true
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'title') {
    const text = await collectText(interaction, 'DM title');
    if (text) {
      setWelcomeDmTitle(GUILD_ID, text);
      await interaction.followUp({ content: '✅ Welcome DM title updated!', ephemeral: true });
    }
  } else if (subcommand === 'description') {
    const text = await collectText(interaction, 'DM description');
    if (text) {
      setWelcomeDmDescription(GUILD_ID, text);
      await interaction.followUp({ content: '✅ Welcome DM description updated!', ephemeral: true });
    }
  } else if (subcommand === 'thumbnail') {
    const text = await collectText(interaction, 'thumbnail URL (or type `none` to remove)', 60000);
    if (text) {
      if (text.toLowerCase() === 'none') {
        setWelcomeDmThumbnail(GUILD_ID, null);
        await interaction.followUp({ content: '✅ Thumbnail removed!', ephemeral: true });
      } else {
        setWelcomeDmThumbnail(GUILD_ID, text);
        await interaction.followUp({ content: '✅ Thumbnail URL updated!', ephemeral: true });
      }
    }
  } else if (subcommand === 'image') {
    const text = await collectText(interaction, 'image URL (or type `none` to remove)', 60000);
    if (text) {
      if (text.toLowerCase() === 'none') {
        setWelcomeDmImage(GUILD_ID, null);
        await interaction.followUp({ content: '✅ Image removed!', ephemeral: true });
      } else {
        setWelcomeDmImage(GUILD_ID, text);
        await interaction.followUp({ content: '✅ Image URL updated!', ephemeral: true });
      }
    }
  } else if (subcommand === 'footergif') {
    const text = await collectText(interaction, 'footer GIF URL (or type `none` to remove)', 60000);
    if (text) {
      if (text.toLowerCase() === 'none') {
        setWelcomeDmFooterGif(GUILD_ID, null);
        await interaction.followUp({ content: '✅ Footer GIF removed!', ephemeral: true });
      } else {
        setWelcomeDmFooterGif(GUILD_ID, text);
        await interaction.followUp({ content: '✅ Footer GIF URL updated!', ephemeral: true });
      }
    }
  }
}
