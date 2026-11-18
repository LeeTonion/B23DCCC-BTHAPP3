import notifee, { AndroidImportance } from '@notifee/react-native';
import {
  limitToLast,
  onValue,
  orderByKey,
  push,
  query,
  ref,
  serverTimestamp,
  update,
} from 'firebase/database';
import { db } from './firebase';

export type NotificationType = 'message' | 'group_add' | 'reaction';

export interface NotificationItem {
  type: NotificationType;
  convId: string;
  fromUid: string;
  text: string;
  createdAt: number;
  read: boolean;
}

const CHANNEL_ID = 'chat_messages';

export function watchNotifications(
  uid: string,
  next: (items: Record<string, NotificationItem>) => void,
  fail: (e: Error) => void,
) {
  return onValue(
    query(ref(db(), `notifications/${uid}`), orderByKey(), limitToLast(50)),
    snapshot => next(snapshot.val() || {}),
    fail,
  );
}

export async function createNotification(
  targetUid: string,
  payload: Omit<NotificationItem, 'createdAt' | 'read'>,
) {
  const newRef = push(ref(db(), `notifications/${targetUid}`));
  if (!newRef.key) {
    return;
  }
  await update(newRef, {
    ...payload,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export function markNotificationRead(uid: string, notifId: string) {
  return update(ref(db(), `notifications/${uid}/${notifId}`), {
    read: true,
  });
}

export function markAllNotificationsRead(uid: string, notifIds: string[]) {
  if (!notifIds.length) {
    return Promise.resolve();
  }
  const updates: Record<string, boolean> = {};
  notifIds.forEach(id => {
    updates[`notifications/${uid}/${id}/read`] = true;
  });
  return update(ref(db()), updates);
}

export async function setupLocalNotifications() {
  try {
    await notifee.requestPermission();
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Tin nhắn và thông báo',
      importance: AndroidImportance.HIGH,
    });
  } catch {
    // Ignore on unsupported environments (e.g., unit tests)
  }
}

export async function showLocalNotification(
  title: string,
  body: string,
  convId?: string,
) {
  try {
    await notifee.displayNotification({
      title,
      body,
      data: convId ? { convId } : undefined,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default' },
      },
    });
  } catch {
    // Ignore when native module is unavailable
  }
}
