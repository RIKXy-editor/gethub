import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getWelcomeText, setWelcomeText } from "../utils/storage.js";
import { GUILD_ID } from "../utils/constants.js";

export const data = new SlashCommandBuilder()
  .setName("setwelcome")
  .setDescription("Set custom welcome message text (admin only)")
  .addStringOption((option) =>
    option
      .setName("text")
      .setDescription(
        "New welcome text (use placeholders like {user}, {server}, {member_count})",
      )
      .setRequired(true),
  )
  // This makes the command visible only to Admins by default
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function parseWelcome(text, member) {
  const safeText = String(text ?? "");

  return safeText
    .replaceAll("{user}", `${member}`) // mention
    .replaceAll("{server}", member.guild.name)
    .replaceAll("{member_count}", `${member.guild.memberCount}`);
}

export async function execute(interaction) {
  try {
    // Must be in a server
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "❌ This command can only be used inside a server.",
        ephemeral: true,
      });
      return;
    }

    // Optional: lock command to only your server
    if (GUILD_ID && interaction.guildId !== GUILD_ID) {
      await interaction.reply({
        content: "❌ This command can only be used in the authorized server.",
        ephemeral: true,
      });
      return;
    }

    // Permission check (works for admin OR owner)
    const isAdmin = interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator,
    );

    // Correct owner check in v14
    const ownerId = interaction.guild.ownerId; // available in v14 when guild is cached
    const isOwner = interaction.user.id === ownerId;

    if (!isAdmin && !isOwner) {
      await interaction.reply({
        content:
          "❌ You need Administrator permission (or be the server owner) to use this command.",
        ephemeral: true,
      });
      return;
    }

    const text = interaction.options.getString("text", true).trim();

    if (!text.length) {
      await interaction.reply({
        content: "❌ Welcome text cannot be empty.",
        ephemeral: true,
      });
      return;
    }

    // Save
    setWelcomeText(interaction.guildId, text);

    // Preview
    const preview = parseWelcome(text, interaction.member);

    await interaction.reply({
      content:
        `✅ Welcome text updated!\n\n` +
        `**Saved Text:**\n${text}\n\n` +
        `**Preview:**\n${preview}`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error in setwelcome:", error);

    // reply safe
    if (interaction.replied || interaction.deferred) {
      await interaction
        .followUp({ content: "❌ An error occurred.", ephemeral: true })
        .catch(() => null);
    } else {
      await interaction
        .reply({ content: "❌ An error occurred.", ephemeral: true })
        .catch(() => null);
    }
  }
}
