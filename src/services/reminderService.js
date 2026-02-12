import cron from 'node-cron';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Reminder, Subscription } from '../db/models.js';

const RESUBSCRIBE_CHANNEL = '1415963231108861952';
const RESUBSCRIBE_GUILD = '1153309880644554804';
const RESUBSCRIBE_URL = `https://discord.com/channels/${RESUBSCRIBE_GUILD}/${RESUBSCRIBE_CHANNEL}`;

export function startReminderScheduler(client) {
  console.log('[REMINDERS] Cron scheduler started.');

  cron.schedule('0 * * * *', async () => {
    await checkReminders(client);
  });

  setTimeout(() => checkReminders(client), 10000);
}

async function checkReminders(client) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const pending = await Reminder.getPending(today);

    if (pending.length === 0) return;
    console.log(`[REMINDERS] Processing ${pending.length} pending reminders.`);

    for (const reminder of pending) {
      try {
        const user = await client.users.fetch(reminder.user_id).catch(() => null);
        if (!user) {
          await Reminder.markSent(reminder.id);
          continue;
        }

        const endDate = new Date(reminder.end_date);
        const endDateStr = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const isFinalDay = reminder.days_before <= 1;

        let description = `Hey there! Your subscription (**${reminder.plan_name}**) is ending soon.\n\n`;
        description += `**Expiry Date:** ${endDateStr}\n`;

        if (reminder.days_before === 1) {
          description += '**Time Left:** Expires tomorrow!\n';
        } else {
          description += `**Time Left:** ${reminder.days_before} days remaining\n`;
        }

        if (isFinalDay) {
          description += '\n🎉 **Renew now and get 10% OFF on your next subscription!**';
        }

        const embed = new EmbedBuilder()
          .setTitle('⏰ Subscription Ending Soon')
          .setDescription(description)
          .setColor(isFinalDay ? '#FF0000' : '#FFA500')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Resubscribe Now')
            .setStyle(ButtonStyle.Link)
            .setURL(RESUBSCRIBE_URL)
        );

        await user.send({ embeds: [embed], components: [row] }).catch(err => {
          console.log(`[REMINDERS] Could not DM ${reminder.user_id}: ${err.message}`);
          Reminder.markError(reminder.id, err.message);
        });

        await Reminder.markSent(reminder.id);
        console.log(`[REMINDERS] Sent reminder to ${reminder.user_id} (${reminder.days_before} days before)`);
      } catch (err) {
        console.error(`[REMINDERS] Error processing reminder ${reminder.id}:`, err.message);
        await Reminder.markError(reminder.id, err.message);
      }
    }

    const activeSubs = await Subscription.getActive();
    const now = new Date();
    for (const sub of activeSubs) {
      if (new Date(sub.end_date) <= now) {
        await Subscription.expire(sub.id);
        console.log(`[REMINDERS] Expired subscription #${sub.id}`);
      }
    }
  } catch (err) {
    console.error('[REMINDERS] Scheduler error:', err);
  }
}
