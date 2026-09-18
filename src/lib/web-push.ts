import webpush from "web-push";
import { prisma } from "./prisma";

// Configure web-push with VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:hello@awaisnazir.tech";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.error("Failed to initialize VAPID details:", err);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Engaging, contextual Urdu / Roman Urdu reminder messages
const MORNING_MESSAGES = [
  "Subah bakhair! Subah ke nashte ya travel ka kharcha foran note kar lein Bahi! ☀️",
  "Subah ka hisab: din shuru hone se pehle subah ke kharche log kar lo taake yaad rahe! 🥐",
  "Assalam-o-Alaikum! Petrol ya subah ki chai ka hisab kitab likh liya? ⛽",
];

const AFTERNOON_MESSAGES = [
  "Dopahar ka hisab: lunch ya doston ke saath chai ka kharcha add kiya Bahi? ☕",
  "Bahi, dopahar ka kharcha foran Hisab Kitab me daal do, baad me bhool jaoge! 🍲",
  "Mid-day check: koi online payment ya cash purchase hui hai to abhi log kar lo! 📱",
];

const EVENING_NIGHT_MESSAGES = [
  "Aj ka kharcha note down kr le Bahi, bad main confusion hogi! 🌙",
  "Raat ka hisab: sone se pehle aj ke tamam expenses log kar lo taake balance barabar rahe! 📝",
  "Din khatam! Cash aur accounts ka hisab mila lein, kal subah sukoon rahega! 💳",
  "Bahi, koi udhar ya split reh to nahi gaya? Ek baar check kar lo! 🤝",
];

const WEEKEND_MESSAGES = [
  "Weekend mubarak! Weekend outing, shopping ya dinner ka kharcha log karna mat bhoolna! 🍕",
  "Weekend hisab kitab: doston ke saath splits ya bill share hue to abhi Hisab Kitab me daal lein! 🎉",
  "Hafte bhar ka hisab: purane udhar aur haftawar kharche check kar lein taake naya hafta clean shuru ho! 📊",
];

/**
 * Returns a contextual reminder message tailored to the day & time
 */
export function getContextualReminder(date = new Date()): { title: string; body: string } {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = day === 0 || day === 6;
  const hour = date.getHours();

  let pool: string[];
  let title = "Hisab Kitab Reminder";

  if (isWeekend) {
    if (hour >= 20 || hour <= 2) {
      pool = EVENING_NIGHT_MESSAGES;
      title = "🌙 Raat ka Hisab Kitab";
    } else {
      pool = WEEKEND_MESSAGES;
      title = "🎉 Weekend Expense Reminder";
    }
  } else {
    if (hour < 12) {
      pool = MORNING_MESSAGES;
      title = "☀️ Subah ka Hisab Kitab";
    } else if (hour < 18) {
      pool = AFTERNOON_MESSAGES;
      title = "☕ Dopahar ka Hisab";
    } else {
      pool = EVENING_NIGHT_MESSAGES;
      title = "📝 Aj ka Kharcha Note Down Kar Lein!";
    }
  }

  // Random pick from the selected message pool
  const randomIndex = Math.floor(Math.random() * pool.length);
  return {
    title,
    body: pool[randomIndex],
  };
}

/**
 * Checks if the current time matches a dynamically randomized reminder window.
 * Rather than a rigid static hour, this creates natural variation every day:
 * - Weekdays:
 *   - Morning: randomly varies around 9:30 AM - 11:30 AM (hours 9, 10, 11)
 *   - Afternoon: randomly varies around 2:30 PM - 4:30 PM (hours 14, 15, 16)
 *   - Evening: randomly varies around 9:00 PM - 11:00 PM (hours 21, 22, 23)
 * - Weekends:
 *   - Brunch: randomly around 11:00 AM - 1:00 PM (hours 11, 12, 13)
 *   - Evening Outing: randomly around 6:00 PM - 8:00 PM (hours 18, 19, 20)
 *   - Night: randomly around 10:30 PM - 12:00 AM (hours 22, 23)
 */
export function isEligibleRandomReminderSlot(date = new Date(), lastPushAt?: Date | null): boolean {
  if (lastPushAt) {
    const hoursSinceLast = (date.getTime() - new Date(lastPushAt).getTime()) / (1000 * 60 * 60);
    // Don't send more than once every 3.5 hours minimum to prevent spamming
    if (hoursSinceLast < 3.5) {
      return false;
    }
  }

  const hour = date.getHours();
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;

  // Use the date number as a pseudo-random seed so the daily target hour fluctuates daily
  const daySeed = (date.getDate() * 7 + date.getMonth() * 13) % 3; // 0, 1, or 2

  if (isWeekend) {
    const slot1 = 11 + (daySeed % 2); // 11 AM or 12 PM
    const slot2 = 18 + (daySeed % 3); // 6 PM, 7 PM, or 8 PM
    const slot3 = 22 + (daySeed % 2); // 10 PM or 11 PM
    return hour === slot1 || hour === slot2 || hour === slot3;
  } else {
    const slot1 = 9 + daySeed; // 9 AM, 10 AM, or 11 AM
    const slot2 = 14 + daySeed; // 2 PM, 3 PM, or 4 PM
    const slot3 = 21 + daySeed; // 9 PM, 10 PM, or 11 PM
    return hour === slot1 || hour === slot2 || hour === slot3;
  }
}

/**
 * Sends a push notification to a specific push subscription
 */
export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<boolean> {
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  const dataString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/dashboard",
    tag: payload.tag || "hisab-kitab-reminder",
  });

  try {
    await webpush.sendNotification(pushSubscription, dataString);
    return true;
  } catch (err: any) {
    // 404 or 410 means subscription is expired or unsubscribed on the client
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.warn("Push subscription expired or unsubscribed, deleting from DB:", sub.endpoint);
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: sub.endpoint },
      });
    } else {
      console.error("Failed to send push notification:", err);
    }
    return false;
  }
}

/**
 * Sends a notification to all active devices registered by a user
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  let sent = 0;
  for (const s of subs) {
    const ok = await sendWebPush(s, payload);
    if (ok) sent++;
  }

  return sent;
}
