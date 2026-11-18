import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import {
  watchUsers,
  watchPresence,
  watchUserChats,
  watchConversation,
  watchConnection,
  sendMessage,
  sendConversationMessage,
  createMessageId,
  conversationId,
  type Message,
  type Profile,
  type Conversation,
  type UserChat,
} from '../services/chat';
import {
  watchNotifications,
  setupLocalNotifications,
  showLocalNotification,
  type NotificationItem,
} from '../services/notificationService';
import { uploadImageToCloudinary } from '../services/uploadService';
import { errorMessage } from '../services/firebase';
import type { Outbox, OutgoingMessage } from '../services/delivery';

interface Data {
  users: Record<string, Profile>;
  presence: Record<string, Record<string, boolean>>;
  chats: Record<string, Conversation>;
  userChats: Record<string, UserChat>;
  notifications: Record<string, NotificationItem>;
  error: string;
  loading: boolean;
  connected: boolean;
}

export interface SendToChatParams {
  convId: string;
  peerId?: string;
  memberUids: string[];
  isGroup: boolean;
  groupName?: string;
  content: Omit<Message, 'senderId' | 'createdAt'>;
  localImageUri?: string;
  imageMeta?: { fileName?: string; type?: string };
}

interface ChatValue extends Data {
  outbox: Outbox;
  send: (
    peer: string,
    content: Omit<Message, 'senderId' | 'createdAt'>,
  ) => string;
  sendToChat: (params: SendToChatParams) => string;
  retry: (key: string) => void;
  dismiss: (key: string) => void;
}

const initial: Data = {
  users: {},
  presence: {},
  chats: {},
  userChats: {},
  notifications: {},
  error: '',
  loading: true,
  connected: true,
};

const Context = createContext<ChatValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<Data>(initial);
  const [outbox, setOutbox] = useState<Outbox>({});
  const outboxRef = useRef<Outbox>({});
  const mounted = useRef(true);
  const inFlight = useRef(new Set<string>());
  const seenNotifs = useRef<Set<string> | null>(null);
  const usersRef = useRef<Record<string, Profile>>({});
  usersRef.current = data.users;

  const updateOutbox = useCallback((change: (old: Outbox) => Outbox) => {
    outboxRef.current = change(outboxRef.current);
    if (mounted.current) {
      setOutbox(outboxRef.current);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    setupLocalNotifications();
    seenNotifs.current = null;
    const fail = (e: Error) =>
      setData(d => ({ ...d, error: errorMessage(e), loading: false }));

    const stops = [
      watchUsers(users => setData(d => ({ ...d, users })), fail),
      watchPresence(presence => setData(d => ({ ...d, presence })), fail),
      watchConnection(connected => setData(d => ({ ...d, connected }))),
      watchUserChats(
        user.uid,
        userChats => setData(d => ({ ...d, userChats, loading: false })),
        fail,
      ),
      watchNotifications(
        user.uid,
        notifications => {
          setData(d => ({ ...d, notifications }));
          const entries = Object.entries(notifications);
          if (seenNotifs.current === null) {
            seenNotifs.current = new Set(entries.map(([k]) => k));
            return;
          }
          entries.forEach(([key, item]) => {
            if (!seenNotifs.current!.has(key)) {
              seenNotifs.current!.add(key);
              if (!item.read && AppState.currentState !== 'active') {
                const senderName =
                  usersRef.current[item.fromUid]?.name || 'Tin nhắn mới';
                showLocalNotification(senderName, item.text, item.convId);
              }
            }
          });
        },
        fail,
      ),
    ];
    return () => stops.forEach(stop => stop());
  }, [user]);

  const convIdsKey = Object.keys(data.userChats).sort().join(',');
  useEffect(() => {
    if (!user || !convIdsKey) {
      return;
    }
    const ids = convIdsKey.split(',').filter(Boolean);
    const fail = (e: Error) =>
      setData(d => ({ ...d, error: errorMessage(e) }));
    const stops = ids.map(convId =>
      watchConversation(
        convId,
        conv => {
          setData(d => {
            const nextChats = { ...d.chats };
            if (conv) {
              nextChats[convId] = conv;
            } else {
              delete nextChats[convId];
            }
            return { ...d, chats: nextChats };
          });
        },
        fail,
      ),
    );
    return () => stops.forEach(stop => stop());
  }, [user, convIdsKey]);

  const transmit = useCallback(
    async (item: OutgoingMessage) => {
      if (inFlight.current.has(item.id)) {
        return;
      }
      inFlight.current.add(item.id);
      updateOutbox(old => ({
        ...old,
        [item.id]: { ...item, state: 'sending', error: undefined },
      }));
      const { senderId, createdAt, ...content } = item.message;
      try {
        let finalContent = { ...content };
        if (item.localImageUri && content.type === 'image') {
          const uploadedUrl = await uploadImageToCloudinary(
            item.localImageUri,
            item.imageMeta?.fileName,
            item.imageMeta?.type,
          );
          finalContent = { ...finalContent, imageUrl: uploadedUrl };
        }

        if (item.memberUids && item.memberUids.length > 0) {
          await sendConversationMessage({
            convId: item.conversationId,
            senderId,
            senderName: item.senderName || 'Bạn',
            memberUids: item.memberUids,
            isGroup: Boolean(item.isGroup),
            groupName: item.groupName,
            content: finalContent,
            messageId: item.id,
          });
          updateOutbox(old => {
            const next = { ...old };
            delete next[item.id];
            return next;
          });
        } else {
          await sendMessage(senderId, item.peerId, finalContent, item.id);
          updateOutbox(old => {
            const next = { ...old };
            delete next[item.id];
            return next;
          });
        }
      } catch (e) {
        updateOutbox(old => ({
          ...old,
          [item.id]: { ...item, state: 'failed', error: errorMessage(e) },
        }));
      } finally {
        inFlight.current.delete(item.id);
      }
    },
    [updateOutbox],
  );

  const send = useCallback(
    (peerId: string, content: Omit<Message, 'senderId' | 'createdAt'>) => {
      if (
        !user ||
        peerId === user.uid ||
        (content.type === 'text' && !content.text?.trim())
      ) {
        throw new Error('Tin nhắn không hợp lệ.');
      }
      const id = createMessageId();
      const item: OutgoingMessage = {
        id,
        peerId,
        conversationId: conversationId(user.uid, peerId),
        message: { ...content, senderId: user.uid, createdAt: Date.now() },
        state: 'sending',
      };
      transmit(item);
      return id;
    },
    [user, transmit],
  );

  const sendToChat = useCallback(
    (params: SendToChatParams) => {
      if (!user) {
        throw new Error('Chưa đăng nhập.');
      }
      const {
        convId,
        peerId = '',
        memberUids,
        isGroup,
        groupName,
        content,
        localImageUri,
        imageMeta,
      } = params;
      if (content.type === 'text' && !content.text?.trim()) {
        throw new Error('Tin nhắn không hợp lệ.');
      }
      const id = createMessageId();
      const senderName =
        data.users[user.uid]?.name || user.displayName || 'Bạn';
      const item: OutgoingMessage = {
        id,
        peerId,
        conversationId: convId,
        message: {
          ...content,
          imageUrl: localImageUri || content.imageUrl,
          senderId: user.uid,
          createdAt: Date.now(),
        },
        state: 'sending',
        localImageUri,
        imageMeta,
        memberUids,
        isGroup,
        groupName,
        senderName,
      };
      transmit(item);
      return id;
    },
    [user, data.users, transmit],
  );

  const retry = useCallback(
    (key: string) => {
      const item = outboxRef.current[key];
      if (item?.state === 'failed') {
        transmit(item);
      }
    },
    [transmit],
  );

  const dismiss = useCallback(
    (key: string) => {
      if (outboxRef.current[key]?.state !== 'failed') {
        return;
      }
      updateOutbox(old => {
        const next = { ...old };
        delete next[key];
        return next;
      });
    },
    [updateOutbox],
  );

  return (
    <Context.Provider
      value={{ ...data, outbox, send, sendToChat, retry, dismiss }}
    >
      {children}
    </Context.Provider>
  );
}

export function useChatData() {
  const data = useContext(Context);
  if (!data) {
    throw new Error('Thiếu ChatProvider');
  }
  return data;
}
