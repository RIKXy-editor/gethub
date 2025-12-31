import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// Array of editing-related jokes
const EDITING_JOKES = [
  "Why did the video editor break up with their timeline? Too many complicated relationships.",
  "What do video editors and magicians have in common? They both know how to make things disappear... and sometimes it's by accident!",
  "A client asked for 'just a small adjustment' at 4:55 PM on Friday. The editor is still adjusting on Monday.",
  "Editing in 4K: 1% actual editing, 99% waiting for renders.",
  "Why do editors make terrible comedians? Because their timing is always off... literally.",
  "A video editor's favorite type of music: The sound of a finished export.",
  "How many editors does it take to change a lightbulb? Three. One to change it, one to say 'that's not the look we discussed,' and one to render it again.",
  "Editors: The only people who can watch 8 hours of footage and create 3 minutes of content.",
  "Why did the editor go to therapy? Too many layers of emotional baggage.",
  "Client feedback: 'Can we make it pop more?' Translation: 'I don't know what I want but I'll know it when I see it.'",
  "An editor's last words: 'Just one more revision...'",
  "What's the difference between an editor and a magician? Magicians know when to reveal their tricks. Editors don't.",
  "Premiere Pro crashed again. An editor was heard screaming into the void.",
  "After Effects render: 'This will take 20 minutes.' *4 hours later*",
  "The only thing scarcer than a client who knows what they want is an editor who met a deadline."
];

const GIPHY_KEYWORDS = [
  'video editing',
  'after effects',
  'timeline',
  'rendering',
  'editor life',
  'client revisions'
];

const EMBED_TITLES = [
  "Editor Humor 🎬",
  "Creative Life 🎨",
  "The Editing Struggle 💪",
  "Post Production Realness 🎞️",
  "Editor's Diary 📝"
];

const EMBED_COLORS = [0xcc0000, 0xff6b6b, 0xff4757, 0xee5a6f, 0xf1556c];

export const data = new SlashCommandBuilder()
  .setName('fun')
  .setDescription('Get a random editing-related joke with a fun GIF!');

async function fetchRandomGif() {
  try {
    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      console.warn('GIPHY_API_KEY not set, skipping GIF fetch');
      return null;
    }

    const keyword = GIPHY_KEYWORDS[Math.floor(Math.random() * GIPHY_KEYWORDS.length)];
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/random?api_key=${apiKey}&tag=${keyword}&rating=g`
    );

    if (!response.ok) {
      console.warn(`Giphy API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.images?.original?.url || null;
  } catch (error) {
    console.error('Error fetching GIF from Giphy:', error);
    return null;
  }
}

export async function execute(interaction) {
  try {
    // Select random joke
    const randomJoke = EDITING_JOKES[Math.floor(Math.random() * EDITING_JOKES.length)];
    const randomTitle = EMBED_TITLES[Math.floor(Math.random() * EMBED_TITLES.length)];
    const randomColor = EMBED_COLORS[Math.floor(Math.random() * EMBED_COLORS.length)];

    // Fetch random GIF from Giphy (gracefully handles failures)
    const gifUrl = await fetchRandomGif();

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(randomTitle)
      .setDescription(randomJoke)
      .setColor(randomColor)
      .setFooter({ text: '😄 Keep creating! Your future self will thank you.' });

    // Add image only if GIF was successfully fetched
    if (gifUrl) {
      embed.setImage(gifUrl);
    }

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in /fun command:', error);
    await interaction.reply({
      content: '❌ There was an error while executing this command!',
      ephemeral: true
    });
  }
}
