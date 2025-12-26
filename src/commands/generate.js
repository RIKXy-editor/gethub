import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const userCooldowns = new Map();
const COOLDOWN_MS = 120000; // 120 seconds

export const data = new SlashCommandBuilder()
  .setName('generate')
  .setDescription('Generate an image using Stable Diffusion')
  .addStringOption(option =>
    option.setName('prompt')
      .setDescription('What you want to generate')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('style')
      .setDescription('Art style (cinematic, realistic, dark, anime)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('ratio')
      .setDescription('Image ratio')
      .setRequired(false)
      .addChoices(
        { name: '1:1', value: '1:1' },
        { name: '16:9', value: '16:9' },
        { name: '9:16', value: '9:16' }
      )
  );

export async function execute(interaction) {
  const userId = interaction.user.id;
  const now = Date.now();
  
  // Check cooldown
  if (userCooldowns.has(userId)) {
    const expirationTime = userCooldowns.get(userId) + COOLDOWN_MS;
    if (now < expirationTime) {
      const timeLeft = Math.ceil((expirationTime - now) / 1000);
      return await interaction.reply({
        content: `⏳ Please wait ${timeLeft} seconds before generating another image.`,
        ephemeral: true
      });
    }
  }
  
  // Set cooldown
  userCooldowns.set(userId, now);
  
  // Defer reply
  await interaction.deferReply();
  
  try {
    const userPrompt = interaction.options.getString('prompt');
    const style = interaction.options.getString('style') || '';
    const ratio = interaction.options.getString('ratio') || '1:1';
    
    // Construct final prompt with base + user input
    const basePrompt = 'high quality, sharp focus, professional lighting, clean composition, detailed, realistic';
    const finalPrompt = style 
      ? `${basePrompt}, ${style}, ${userPrompt}`
      : `${basePrompt}, ${userPrompt}`;
    
    const negativePrompt = 'blurry, low quality, distorted, watermark, text, artifacts, extra limbs';
    
    // Call Stable Diffusion API
    const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-v3/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.STABLE_DIFFUSION_API_KEY}`
      },
      body: JSON.stringify({
        prompt: finalPrompt,
        negative_prompt: negativePrompt,
        aspect_ratio: ratio,
        output_format: 'jpeg'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Stable Diffusion API error:', error);
      return await interaction.editReply({
        content: '❌ Failed to generate image. Please try again later.'
      });
    }
    
    const data = await response.json();
    
    if (!data.artifacts || data.artifacts.length === 0) {
      return await interaction.editReply({
        content: '❌ No image was generated. Please try a different prompt.'
      });
    }
    
    // Get base64 image from response
    const imageBase64 = data.artifacts[0].base64;
    
    // Create embed with image
    const embed = new EmbedBuilder()
      .setColor(0x7B68EE)
      .setTitle('🎨 Generated Image')
      .setDescription(`**Prompt:** ${userPrompt}${style ? `\n**Style:** ${style}` : ''}`)
      .setImage(`data:image/jpeg;base64,${imageBase64}`)
      .setFooter({ text: 'Powered by Stable Diffusion' });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error generating image:', error);
    await interaction.editReply({
      content: '❌ An error occurred while generating the image.'
    });
  }
}
