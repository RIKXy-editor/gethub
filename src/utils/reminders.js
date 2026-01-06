import { EmbedBuilder } from 'discord.js';
import db from './database.js';

export async function checkReminders(client) {
  console.log('Running 12-hour reminder check...');
  const now = new Date();
  const fourDaysFromNow = new Date();
  fourDaysFromNow.setDate(now.getDate() + 4);

  const fourDaysStr = fourDaysFromNow.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Find active subscriptions ending in 4 days or less that haven't been reminded today
  const subs = db.prepare(`
    SELECT * FROM subscriptions 
    WHERE active = 1 
    AND end_date <= ? 
    AND (next_reminder_date IS NULL OR next_reminder_date < ?)
  `).all(fourDaysStr, todayStr);

  for (const sub of subs) {
    try {
      const user = await client.users.fetch(sub.user_id);
      if (!user) continue;

      const embed = new EmbedBuilder()
        .setTitle('Adobe Subscription Reminder')
        .setDescription('Your subscription is expiring soon!')
        .setColor('#ff9900')
        .addFields(
          { name: 'Plan', value: sub.plan, inline: true },
          { name: 'Expiry Date', value: `${sub.end_date} (UTC)`, inline: true }
        )
        .setTimestamp();

      await user.send({ embeds: [embed] });
      
      // Update next_reminder_date to today so we don't spam until tomorrow
      db.prepare('UPDATE subscriptions SET next_reminder_date = ? WHERE user_id = ?')
        .run(todayStr, sub.user_id);
        
      console.log(`Sent reminder to ${user.tag}`);
    } catch (error) {
      console.error(`Could not send DM to ${sub.user_id}:`, error.message);
    }
  }

  // Check for expired subscriptions
  const expiredSubs = db.prepare(`
    SELECT * FROM subscriptions 
    WHERE active = 1 
    AND end_date <= ?
  `).all(todayStr);

  for (const sub of expiredSubs) {
    try {
      // Mark as inactive first to avoid repeat processing
      db.prepare('UPDATE subscriptions SET active = 0 WHERE user_id = ?').run(sub.user_id);

      const user = await client.users.fetch(sub.user_id);
      if (user) {
        const endEmbed = new EmbedBuilder()
          .setTitle('Subscription Ended')
          .setDescription('Your Adobe subscription has officially expired.')
          .setColor('#ff0000')
          .setTimestamp();

        await user.send({ embeds: [endEmbed] });
        console.log(`Sent expiration notice to ${user.tag}`);
      }
    } catch (error) {
      console.error(`Could not send expiration DM to ${sub.user_id}:`, error.message);
    }
  }
}
