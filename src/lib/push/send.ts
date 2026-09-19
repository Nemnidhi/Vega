import webpush from "web-push";
import { PushSubscriptionModel } from "@/models/PushSubscription";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const contact = process.env.VAPID_CONTACT_EMAIL ?? "";

export const pushConfigured = Boolean(publicKey && privateKey && contact);

if (pushConfigured) {
  webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);
}

/** Shape the service worker's `push` handler expects. Keep the two in step. */
export interface PushPayload {
  title: string;
  body: string;
  /** Path opened when the notification is tapped. */
  url: string;
  /**
   * Notifications sharing a tag collapse into one row in the drawer. Tagging by
   * conversation means ten messages from one person replace each other instead
   * of burying the rest of the user's notifications.
   */
  tag?: string;
  /**
   * User id a drawer reply should be sent to. Present only for notifications that
   * can be answered; the service worker offers the reply box when it is set.
   */
  replyTo?: string;
}

/**
 * Fan a notification out to every device a user has registered.
 *
 * Never throws: a failed push must not roll back the action that triggered it -
 * a chat message is still delivered in-app whether or not the phone lights up.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pushConfigured) return { sent: 0, failed: 0 };

  const subscriptions = await PushSubscriptionModel.find({ userId }).lean();
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const body = JSON.stringify(payload);
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        // 404/410 mean the browser threw the subscription away (permission revoked,
        // app uninstalled, site data cleared). Anything else is transient - keep the
        // row so the next message can retry.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          expired.push(subscription.endpoint);
        } else {
          console.error("sendPushToUser failed:", status, (error as Error).message);
        }
      }
    }),
  );

  if (expired.length > 0) {
    await PushSubscriptionModel.deleteMany({ endpoint: { $in: expired } });
  }
  if (sent > 0) {
    await PushSubscriptionModel.updateMany({ userId }, { $set: { lastSuccessAt: new Date() } });
  }

  return { sent, failed };
}
