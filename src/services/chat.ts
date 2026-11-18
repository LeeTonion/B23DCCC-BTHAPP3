import { AppState } from 'react-native';
import {
  endBefore,
  get,
  increment,
  limitToLast,
  onDisconnect,
  onValue,
  orderByKey,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { db } from './firebase';
import { createNotification } from './notificationService';

export interface Profile {
  name: string;
  avatarUrl?: string;
  lastSeen?: number;
}

export type MessageType = 'text' | 'image' | 'location' | 'system';

export interface ReplyRef {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: MessageType;
}

export interface Message {
  senderId: string;
  type: MessageType;
  text?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  createdAt: number;
  recalled?: boolean;
  reactions?: Record<string, string>;
  replyTo?: ReplyRef;
}

export interface Conversation {
  type?: 'direct' | 'group';
  name?: string;
  members: Record<string, boolean>;
  createdBy?: string;
  createdAt?: number;
  messages?: Record<string, Message>;
  read?: Record<string, string>;
}

export interface UserChat {
  lastMessage: string;
  lastSenderId: string;
  updatedAt: number;
  unread: number;
}

export function conversationId(a: string, b: string) {
  return [a, b].sort().join('_');
}

export function watchUsers(
  next: (users: Record<string, Profile>) => void,
  fail: (e: Error) => void,
) {
  return onValue(ref(db(), 'users'), s => next(s.val() || {}), fail);
}

export function watchPresence(
  next: (users: Record<string, Record<string, boolean>>) => void,
  fail: (e: Error) => void,
) {
  return onValue(ref(db(), 'presence'), s => next(s.val() || {}), fail);
}

export function watchUserChats(
  uid: string,
  next: (items: Record<string, UserChat>) => void,
  fail: (e: Error) => void,
) {
  return onValue(ref(db(), `userChats/${uid}`), s => next(s.val() || {}), fail);
}

export function watchConversation(
  convId: string,
  next: (conv: Conversation | null) => void,
  fail: (e: Error) => void,
) {
  return onValue(
    ref(db(), `conversations/${convId}`),
    s => next(s.val() || null),
    fail,
  );
}

export function startPresence(uid: string, fail: (e: Error) => void) {
  const session = push(ref(db(), `presence/${uid}`));
  const lastSeenRef = ref(db(), `users/${uid}/lastSeen`);
  let active = true;
  let generation = 0;

  const publish = async () => {
    const version = ++generation;
    try {
      await onDisconnect(session).remove();
      await onDisconnect(lastSeenRef).set(serverTimestamp());
      if (
        active &&
        version === generation &&
        AppState.currentState === 'active'
      ) {
        await set(session, true);
      }
    } catch (e) {
      if (active) {
        fail(e as Error);
      }
    }
  };

  const markOffline = () => {
    set(session, null).catch(fail);
    set(lastSeenRef, serverTimestamp()).catch(fail);
  };

  const stop = onValue(
    ref(db(), '.info/connected'),
    s => {
      if (s.val()) {
        publish();
      }
    },
    fail,
  );

  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') {
      publish();
    } else {
      generation++;
      markOffline();
    }
  });

  return async () => {
    active = false;
    generation++;
    stop();
    sub.remove();
    await Promise.all([
      set(session, null),
      set(lastSeenRef, serverTimestamp()),
    ]);
  };
}

export function watchConnection(next: (connected: boolean) => void) {
  return onValue(ref(db(), '.info/connected'), s => next(s.val() === true));
}

export function createMessageId() {
  const key = push(ref(db(), 'messageIds')).key;
  if (!key) {
    throw new Error('Không tạo được mã tin nhắn.');
  }
  return key;
}

export function watchLatestMessages(
  convId: string,
  limit: number,
  next: (messages: Record<string, Message>) => void,
  fail: (e: Error) => void,
) {
  return onValue(
    query(ref(db(), `messages/${convId}`), orderByKey(), limitToLast(limit)),
    s => next(s.val() || {}),
    fail,
  );
}

export async function fetchOlderMessages(
  convId: string,
  endBeforeKey: string,
  limit = 20,
): Promise<Record<string, Message>> {
  const snapshot = await get(
    query(
      ref(db(), `messages/${convId}`),
      orderByKey(),
      endBefore(endBeforeKey),
      limitToLast(limit),
    ),
  );
  return snapshot.val() || {};
}

export async function sendConversationMessage(params: {
  convId: string;
  senderId: string;
  senderName: string;
  memberUids: string[];
  isGroup: boolean;
  groupName?: string;
  content: Omit<Message, 'senderId' | 'createdAt'>;
  messageId?: string;
}) {
  const {
    convId,
    senderId,
    senderName,
    memberUids,
    isGroup,
    groupName,
    content,
    messageId = createMessageId(),
  } = params;

  if (content.type === 'text' && !content.text?.trim()) {
    return;
  }

  const updates: Record<string, unknown> = {};

  if (!isGroup) {
    updates[`conversations/${convId}/type`] = 'direct';
    memberUids.forEach(mUid => {
      updates[`conversations/${convId}/members/${mUid}`] = true;
    });
  }

  const cleanContent: Record<string, unknown> = {
    senderId,
    type: content.type,
    createdAt: serverTimestamp(),
  };
  if (content.text !== undefined) {
    cleanContent.text = content.text;
  }
  if (content.imageUrl !== undefined) {
    cleanContent.imageUrl = content.imageUrl;
  }
  if (content.latitude !== undefined) {
    cleanContent.latitude = content.latitude;
  }
  if (content.longitude !== undefined) {
    cleanContent.longitude = content.longitude;
  }
  if (content.replyTo !== undefined) {
    cleanContent.replyTo = content.replyTo;
  }

  updates[`messages/${convId}/${messageId}`] = cleanContent;

  const lastMsg = preview(content);
  memberUids.forEach(mUid => {
    updates[`userChats/${mUid}/${convId}/lastMessage`] = lastMsg;
    updates[`userChats/${mUid}/${convId}/lastSenderId`] = senderId;
    updates[`userChats/${mUid}/${convId}/updatedAt`] = serverTimestamp();
    if (mUid === senderId) {
      updates[`userChats/${mUid}/${convId}/unread`] = 0;
    } else {
      updates[`userChats/${mUid}/${convId}/unread`] = increment(1);
    }
  });

  updates[`typing/${convId}/${senderId}`] = null;

  await update(ref(db()), updates);

  const recipients = memberUids.filter(mUid => mUid !== senderId);
  await Promise.all(
    recipients.map(async mUid => {
      try {
        const activeSnap = await get(ref(db(), `activeChat/${mUid}`));
        if (activeSnap.val() === convId) {
          return;
        }
        const prefix =
          isGroup && groupName ? `[${groupName}] ${senderName}` : senderName;
        await createNotification(mUid, {
          type: 'message',
          convId,
          fromUid: senderId,
          text: `${prefix}: ${lastMsg}`,
        });
      } catch {
        // Notification failure should not break message sending
      }
    }),
  );
}

export async function sendMessage(
  uid: string,
  peer: string,
  content: Omit<Message, 'senderId' | 'createdAt'>,
  messageId = createMessageId(),
) {
  if (uid === peer || (content.type === 'text' && !content.text?.trim())) {
    return;
  }
  const convId = conversationId(uid, peer);
  await sendConversationMessage({
    convId,
    senderId: uid,
    senderName: 'Bạn',
    memberUids: [uid, peer],
    isGroup: false,
    content,
    messageId,
  });
}

export function markConversationRead(convId: string, uid: string) {
  return update(ref(db()), {
    [`readStatus/${convId}/${uid}`]: serverTimestamp(),
    [`userChats/${uid}/${convId}/unread`]: 0,
  });
}

export function markRead(id: string, uid: string, key: string) {
  return runTransaction(
    ref(db(), `conversations/${id}/read/${uid}`),
    current => {
      if (typeof current === 'string' && current >= key) {
        return;
      }
      return key;
    },
    { applyLocally: false },
  );
}

export function watchReadStatus(
  convId: string,
  next: (status: Record<string, number>) => void,
  fail: (e: Error) => void,
) {
  return onValue(
    ref(db(), `readStatus/${convId}`),
    s => next(s.val() || {}),
    fail,
  );
}

export function watchTyping(
  convId: string,
  next: (typing: Record<string, boolean>) => void,
  fail: (e: Error) => void,
) {
  return onValue(
    ref(db(), `typing/${convId}`),
    s => next(s.val() || {}),
    fail,
  );
}

export async function setTyping(
  convId: string,
  uid: string,
  isTyping: boolean,
) {
  const typingRef = ref(db(), `typing/${convId}/${uid}`);
  if (isTyping) {
    await onDisconnect(typingRef).remove();
    await set(typingRef, true);
  } else {
    await remove(typingRef);
  }
}

export async function setActiveChat(uid: string, convId: string | null) {
  const activeRef = ref(db(), `activeChat/${uid}`);
  if (convId) {
    await onDisconnect(activeRef).remove();
    await set(activeRef, convId);
  } else {
    await remove(activeRef);
  }
}

export async function recallMessage(
  convId: string,
  msgId: string,
  memberUids: string[],
  isLatest: boolean,
) {
  const updates: Record<string, unknown> = {
    [`messages/${convId}/${msgId}/recalled`]: true,
  };
  if (isLatest) {
    memberUids.forEach(mUid => {
      updates[`userChats/${mUid}/${convId}/lastMessage`] =
        'Tin nhắn đã được thu hồi';
    });
  }
  await update(ref(db()), updates);
}

export async function toggleReaction(params: {
  convId: string;
  msgId: string;
  uid: string;
  emoji: string;
  currentEmoji?: string;
  msgSenderId?: string;
  actorName?: string;
}) {
  const { convId, msgId, uid, emoji, currentEmoji, msgSenderId, actorName } =
    params;
  const nextVal = currentEmoji === emoji ? null : emoji;
  await set(ref(db(), `messages/${convId}/${msgId}/reactions/${uid}`), nextVal);

  if (nextVal && msgSenderId && msgSenderId !== uid) {
    try {
      await createNotification(msgSenderId, {
        type: 'reaction',
        convId,
        fromUid: uid,
        text: `${actorName || 'Ai đó'} đã thả ${emoji} vào tin nhắn của bạn`,
      });
    } catch {
      // Ignore notification error
    }
  }
}

export function messageEntries(chat?: Conversation) {
  return Object.entries(chat?.messages || {}).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
}

export function unreadCount(chat: Conversation, uid: string) {
  return messageEntries(chat).filter(
    ([key, m]) => m.senderId !== uid && key > (chat.read?.[uid] || ''),
  ).length;
}

export function timeLabel(timestamp?: number) {
  return timestamp
    ? new Date(timestamp).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Đang gửi';
}

export function formatLastSeen(lastSeen?: number): string {
  if (!lastSeen) {
    return 'Không hoạt động';
  }
  const diffMin = Math.floor((Date.now() - lastSeen) / 60000);
  if (diffMin < 1) {
    return 'Vừa mới hoạt động';
  }
  if (diffMin < 60) {
    return `Hoạt động ${diffMin} phút trước`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `Hoạt động ${diffHour} giờ trước`;
  }
  const diffDay = Math.floor(diffHour / 24);
  return `Hoạt động ${diffDay} ngày trước`;
}

export function preview(m?: Pick<Message, 'type' | 'text' | 'recalled'>) {
  if (m?.recalled) {
    return 'Tin nhắn đã được thu hồi';
  }
  if (m?.type === 'image') {
    return '📷 Hình ảnh';
  }
  if (m?.type === 'location') {
    return '📍 Vị trí';
  }
  return m?.text || '';
}
