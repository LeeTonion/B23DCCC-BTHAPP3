import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/Avatar';
import { GroupInfoModal } from '../components/GroupInfoModal';
import { MessageStatus } from '../components/MessageStatus';
import { useAuth } from '../context/AuthContext';
import { useChatData } from '../context/ChatContext';
import {
  conversationId,
  fetchOlderMessages,
  formatLastSeen,
  markConversationRead,
  preview,
  recallMessage,
  setActiveChat,
  setTyping,
  timeLabel,
  toggleReaction,
  watchLatestMessages,
  watchReadStatus,
  watchTyping,
  type Message,
  type ReplyRef,
} from '../services/chat';
import {
  dateDivider,
  deliveryStateByTime,
  mergedMessages,
} from '../services/delivery';
import { errorMessage } from '../services/firebase';
import { currentLocation } from '../services/location';
import {
  pickImageFromCamera,
  pickImageFromLibrary,
} from '../services/uploadService';
import type { RootStackScreenProps } from '../navigation/types';
import { colors } from '../theme/colors';

type Entry = [string, Message];

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];
const PAGE_SIZE = 20;

export function ChatDetailScreen({
  route,
  navigation,
}: RootStackScreenProps<'ChatDetail'>) {
  const { peerId = '', name, isGroup: paramIsGroup } = route.params;
  const { user } = useAuth();
  const {
    users,
    presence,
    chats,
    userChats,
    error,
    outbox,
    connected,
    sendToChat,
    retry,
    dismiss,
  } = useChatData();

  const uid = user!.uid;
  const convId = route.params.convId || conversationId(uid, peerId);
  const chat = chats[convId];
  const isGroup = Boolean(paramIsGroup || chat?.type === 'group');
  const ownName = users[uid]?.name || user?.displayName || 'Bạn';

  const memberUids = useMemo(() => {
    const keys = Object.keys(chat?.members || {});
    if (keys.length > 0) {
      return keys;
    }
    return peerId ? [uid, peerId] : [uid];
  }, [chat?.members, peerId, uid]);

  const resolvedPeerId = useMemo(
    () => peerId || memberUids.find(id => id !== uid) || '',
    [peerId, memberUids, uid],
  );

  const headerTitle = isGroup
    ? chat?.name || name
    : users[resolvedPeerId]?.name || name;

  const peerOnline = useMemo(() => {
    if (isGroup) {
      return memberUids.some(
        id => id !== uid && Object.values(presence[id] || {}).some(Boolean),
      );
    }
    return Object.values(presence[resolvedPeerId] || {}).some(Boolean);
  }, [isGroup, memberUids, uid, presence, resolvedPeerId]);

  const groupOnlineCount = useMemo(() => {
    if (!isGroup) {
      return 0;
    }
    return memberUids.filter(id =>
      Object.values(presence[id] || {}).some(Boolean),
    ).length;
  }, [isGroup, memberUids, presence]);

  // Pagination & realtime messages
  const [liveMessages, setLiveMessages] = useState<Record<string, Message>>({});
  const [olderMessages, setOlderMessages] = useState<Record<string, Message>>(
    {},
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [readStatus, setReadStatus] = useState<Record<string, number>>({});
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  const [locating, setLocating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [actionEntry, setActionEntry] = useState<Entry | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [groupModalVisible, setGroupModalVisible] = useState(false);

  // In-chat search (Part C)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const focused = useIsFocused();
  const list = useRef<FlatList<Entry>>(null);
  const bottomRef = useRef(true);
  const initialScroll = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const combinedMessages = useMemo(
    () => ({ ...olderMessages, ...liveMessages }),
    [olderMessages, liveMessages],
  );

  const messages = useMemo(
    () => mergedMessages(undefined, convId, outbox, combinedMessages),
    [convId, outbox, combinedMessages],
  );

  const latestKey = messages.at(-1)?.[0];
  const latestSender = messages.at(-1)?.[1].senderId;

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('vi');
    if (!q) {
      return [];
    }
    return messages
      .map(([k, m], idx) => ({ key: k, m, idx }))
      .filter(
        ({ m }) =>
          !m.recalled &&
          m.type === 'text' &&
          m.text?.toLocaleLowerCase('vi').includes(q),
      );
  }, [messages, searchQuery]);

  // Peer read timestamp (for 1-1 or latest among other group members)
  const { peerReadAt, seenPeerName, seenPeerAvatar } = useMemo(() => {
    if (!isGroup) {
      return {
        peerReadAt: readStatus[resolvedPeerId],
        seenPeerName: headerTitle,
        seenPeerAvatar: users[resolvedPeerId]?.avatarUrl,
      };
    }
    let maxAt = 0;
    let maxUid = '';
    memberUids.forEach(id => {
      if (id !== uid && (readStatus[id] || 0) > maxAt) {
        maxAt = readStatus[id];
        maxUid = id;
      }
    });
    return {
      peerReadAt: maxAt || undefined,
      seenPeerName: users[maxUid]?.name || 'Thành viên',
      seenPeerAvatar: users[maxUid]?.avatarUrl,
    };
  }, [isGroup, readStatus, resolvedPeerId, headerTitle, users, memberUids, uid]);

  const lastOwnEntry = useMemo(
    () =>
      messages
        .filter(([, m]) => m.senderId === uid && m.type !== 'system')
        .at(-1),
    [messages, uid],
  );

  // Typing subtitle
  const headerSubtitle = useMemo(() => {
    const typingOthers = Object.entries(typingMap)
      .filter(([id, val]) => id !== uid && val)
      .map(([id]) => users[id]?.name || 'Ai đó');
    if (typingOthers.length > 0) {
      return isGroup
        ? `${typingOthers[0]} đang soạn tin…`
        : 'đang soạn tin…';
    }
    if (isGroup) {
      return `${groupOnlineCount} thành viên đang hoạt động`;
    }
    if (peerOnline) {
      return 'Đang hoạt động';
    }
    return formatLastSeen(users[resolvedPeerId]?.lastSeen);
  }, [
    typingMap,
    uid,
    users,
    isGroup,
    groupOnlineCount,
    peerOnline,
    resolvedPeerId,
  ]);

  const scrollToBottom = useCallback((animated = true) => {
    bottomRef.current = true;
    setNearBottom(true);
    setNewCount(0);
    list.current?.scrollToEnd({ animated });
  }, []);

  // AppState listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', s =>
      setActive(s === 'active'),
    );
    return () => sub.remove();
  }, []);

  // Realtime listeners for messages (limitToLast 20), readStatus, typing
  useEffect(() => {
    setOlderMessages({});
    setHasMore(true);
    const fail = () => {};
    const stops = [
      watchLatestMessages(
        convId,
        PAGE_SIZE,
        msgs => {
          setLiveMessages(msgs);
          if (Object.keys(msgs).length < PAGE_SIZE) {
            setHasMore(false);
          }
        },
        fail,
      ),
      watchReadStatus(convId, setReadStatus, fail),
      watchTyping(convId, setTypingMap, fail),
    ];
    return () => stops.forEach(stop => stop());
  }, [convId]);

  // Active chat & typing cleanup
  useEffect(() => {
    if (focused && active) {
      setActiveChat(uid, convId).catch(() => {});
    } else {
      setActiveChat(uid, null).catch(() => {});
    }
    return () => {
      setActiveChat(uid, null).catch(() => {});
    };
  }, [focused, active, uid, convId]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      if (isTypingRef.current) {
        setTyping(convId, uid, false).catch(() => {});
      }
    };
  }, [convId, uid]);

  // Mark conversation as read when focused & active
  const currentUnread = userChats[convId]?.unread || 0;
  useEffect(() => {
    if (!focused || !active || !connected) {
      return;
    }
    if (currentUnread > 0 || (latestSender && latestSender !== uid)) {
      markConversationRead(convId, uid).catch(() => {});
    }
  }, [focused, active, connected, currentUnread, latestKey, latestSender, convId, uid]);

  // Auto scroll to bottom on initial load or new own message
  useEffect(() => {
    if (!focused || !latestKey) {
      return;
    }
    if (!initialScroll.current || bottomRef.current || latestSender === uid) {
      const animate = initialScroll.current;
      initialScroll.current = true;
      const frame = requestAnimationFrame(() => scrollToBottom(animate));
      return () => cancelAnimationFrame(frame);
    }
    setNewCount(n => n + 1);
  }, [latestKey, latestSender, uid, focused, scrollToBottom]);

  async function loadMoreOlder() {
    if (loadingMore || !hasMore) {
      return;
    }
    const oldestKey = messages[0]?.[0];
    if (!oldestKey) {
      return;
    }
    setLoadingMore(true);
    try {
      const fetched = await fetchOlderMessages(convId, oldestKey, PAGE_SIZE);
      const keys = Object.keys(fetched);
      if (keys.length < PAGE_SIZE) {
        setHasMore(false);
      }
      if (keys.length > 0) {
        setOlderMessages(prev => ({ ...fetched, ...prev }));
      }
    } catch {
      // Ignore pagination failure
    } finally {
      setLoadingMore(false);
    }
  }

  function handleDraftChange(text: string) {
    setDraft(text);
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    if (text.trim().length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        setTyping(convId, uid, true).catch(() => {});
      }
      typingTimer.current = setTimeout(() => {
        isTypingRef.current = false;
        setTyping(convId, uid, false).catch(() => {});
      }, 3000);
    } else if (isTypingRef.current) {
      isTypingRef.current = false;
      setTyping(convId, uid, false).catch(() => {});
    }
  }

  function clearTypingNow() {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      setTyping(convId, uid, false).catch(() => {});
    }
  }

  function sendText() {
    const text = draft.trim();
    if (!text) {
      return;
    }
    clearTypingNow();
    try {
      sendToChat({
        convId,
        peerId: resolvedPeerId,
        memberUids,
        isGroup,
        groupName: chat?.name || name,
        content: {
          type: 'text',
          text,
          ...(replyTarget ? { replyTo: replyTarget } : {}),
        },
      });
      setDraft('');
      setReplyTarget(null);
      scrollToBottom();
    } catch (e) {
      Alert.alert('Không gửi được tin', errorMessage(e));
    }
  }

  async function sendLocation() {
    if (locating) {
      return;
    }
    setLocating(true);
    try {
      const coords = await currentLocation();
      sendToChat({
        convId,
        peerId: resolvedPeerId,
        memberUids,
        isGroup,
        groupName: chat?.name || name,
        content: {
          type: 'location',
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...(replyTarget ? { replyTo: replyTarget } : {}),
        },
      });
      setReplyTarget(null);
      scrollToBottom();
    } catch (e) {
      Alert.alert('Gửi vị trí', errorMessage(e));
    } finally {
      setLocating(false);
    }
  }

  async function pickAndSendImage(source: 'camera' | 'library') {
    try {
      const picked =
        source === 'camera'
          ? await pickImageFromCamera()
          : await pickImageFromLibrary();
      if (!picked) {
        return;
      }
      sendToChat({
        convId,
        peerId: resolvedPeerId,
        memberUids,
        isGroup,
        groupName: chat?.name || name,
        content: {
          type: 'image',
          imageUrl: picked.uri,
          ...(replyTarget ? { replyTo: replyTarget } : {}),
        },
        localImageUri: picked.uri,
        imageMeta: { fileName: picked.fileName, type: picked.type },
      });
      setReplyTarget(null);
      scrollToBottom();
    } catch (e) {
      Alert.alert('Gửi ảnh', errorMessage(e));
    }
  }

  function openImageOptions() {
    Alert.alert('Gửi hình ảnh', 'Chọn nguồn ảnh', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Chụp ảnh', onPress: () => pickAndSendImage('camera') },
      { text: 'Chọn từ thư viện', onPress: () => pickAndSendImage('library') },
    ]);
  }

  function handleReaction(emoji: string) {
    if (!actionEntry) {
      return;
    }
    const [msgId, msg] = actionEntry;
    setActionEntry(null);
    toggleReaction({
      convId,
      msgId,
      uid,
      emoji,
      currentEmoji: msg.reactions?.[uid],
      msgSenderId: msg.senderId,
      actorName: ownName,
    }).catch(e => Alert.alert('Lỗi', errorMessage(e)));
  }

  function handleCopy() {
    if (!actionEntry) {
      return;
    }
    const [, msg] = actionEntry;
    setActionEntry(null);
    if (msg.text) {
      Clipboard.setString(msg.text);
    }
  }

  function handleReply() {
    if (!actionEntry) {
      return;
    }
    const [msgId, msg] = actionEntry;
    setActionEntry(null);
    setReplyTarget({
      id: msgId,
      senderId: msg.senderId,
      senderName:
        msg.senderId === uid
          ? 'Bạn'
          : users[msg.senderId]?.name || 'Thành viên',
      text: preview(msg),
      type: msg.type,
    });
  }

  function handleRecall() {
    if (!actionEntry) {
      return;
    }
    const [msgId] = actionEntry;
    setActionEntry(null);
    recallMessage(convId, msgId, memberUids, msgId === latestKey).catch(e =>
      Alert.alert('Không thể thu hồi', errorMessage(e)),
    );
  }

  function scrollToMessageId(targetId: string) {
    const index = messages.findIndex(([k]) => k === targetId);
    if (index >= 0) {
      list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={styles.root}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Quay lại danh sách chat"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={26} color={colors.primary} />
        </Pressable>
        <Avatar
          name={headerTitle}
          avatarUrl={!isGroup ? users[resolvedPeerId]?.avatarUrl : undefined}
          size={42}
          online={peerOnline}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={styles.headerStatus} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tìm kiếm tin nhắn"
          style={styles.iconButton}
          onPress={() => {
            setSearchOpen(v => !v);
            setSearchQuery('');
          }}
        >
          <Ionicons name="search-outline" size={23} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông tin cuộc trò chuyện"
          style={styles.iconButton}
          onPress={() => {
            if (isGroup && chat) {
              setGroupModalVisible(true);
            } else {
              Alert.alert(
                headerTitle,
                `${headerSubtitle}\n\nNhấn giữ tin nhắn để trả lời, sao chép, thả cảm xúc hoặc thu hồi.`,
              );
            }
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={25}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {searchOpen && (
        <View style={styles.searchPanel}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm nội dung tin nhắn…"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchMatches.length > 0 && (
            <Pressable
              style={styles.searchJumpBtn}
              onPress={() => scrollToMessageId(searchMatches.at(-1)!.key)}
            >
              <Text style={styles.searchCount}>
                {searchMatches.length} kết quả · Tới
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {(!connected || !!error) && (
        <View style={styles.notice}>
          <Ionicons
            name="cloud-offline-outline"
            size={17}
            color={colors.textMuted}
          />
          <Text style={styles.noticeText}>
            {error || 'Đang kết nối lại. Tin đang gửi sẽ tiếp tục khi có mạng.'}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex}>
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={([key]) => key}
            style={styles.flex}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onScrollToIndexFailed={() => {}}
            scrollEventThrottle={32}
            onScroll={({
              nativeEvent: { layoutMeasurement, contentOffset, contentSize },
            }) => {
              if (contentOffset.y <= 40 && hasMore && !loadingMore) {
                loadMoreOlder();
              }
              const bottom =
                layoutMeasurement.height + contentOffset.y >=
                contentSize.height - 90;
              bottomRef.current = bottom;
              setNearBottom(bottom);
              if (bottom) {
                setNewCount(0);
              }
            }}
            onContentSizeChange={() => {
              if (bottomRef.current) {
                list.current?.scrollToEnd({ animated: false });
              }
            }}
            ListHeaderComponent={
              loadingMore ? (
                <View style={styles.loaderTop}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <View style={styles.profile}>
                  <Avatar
                    name={headerTitle}
                    avatarUrl={!isGroup ? users[resolvedPeerId]?.avatarUrl : undefined}
                    size={76}
                  />
                  <Text style={styles.profileName}>{headerTitle}</Text>
                  <Text style={styles.profileSubtitle}>
                    {isGroup
                      ? `${memberUids.length} thành viên`
                      : 'Các bạn đã kết nối trên chat'}
                  </Text>
                </View>
              )
            }
            renderItem={({ item: [key, m], index }) => {
              if (m.type === 'system') {
                return (
                  <View style={styles.systemRow}>
                    <Text style={styles.systemText}>{m.text}</Text>
                  </View>
                );
              }

              const mine = m.senderId === uid;
              const senderProfile = users[m.senderId];
              const senderName = senderProfile?.name || 'Thành viên';
              const previous = messages[index - 1]?.[1];
              const next = messages[index + 1]?.[1];
              const newDay =
                !previous ||
                new Date(m.createdAt).toDateString() !==
                  new Date(previous.createdAt).toDateString();
              const newTime =
                !previous || m.createdAt - previous.createdAt > 15 * 60 * 1000;
              const grouped =
                !!previous &&
                previous.type !== 'system' &&
                previous.senderId === m.senderId &&
                !newDay &&
                m.createdAt - previous.createdAt < 2 * 60 * 1000;
              const groupEnd =
                !next ||
                next.type === 'system' ||
                next.senderId !== m.senderId ||
                next.createdAt - m.createdAt > 2 * 60 * 1000;

              const outItem = outbox[key];
              const state = deliveryStateByTime(
                m.createdAt,
                peerReadAt,
                outItem,
              );
              const failed = mine && state === 'failed';
              const sending = mine && state === 'sending';
              const isLastOwn = lastOwnEntry?.[0] === key;
              const showStatus =
                mine && (isLastOwn || sending || failed || selected === key);

              // Aggregate reactions
              const reactionCounts: Record<string, number> = {};
              Object.values(m.reactions || {}).forEach(emoji => {
                reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
              });
              const reactionList = Object.entries(reactionCounts);

              const highlighted =
                searchOpen &&
                searchQuery.trim() &&
                !m.recalled &&
                m.type === 'text' &&
                m.text
                  ?.toLocaleLowerCase('vi')
                  .includes(searchQuery.trim().toLocaleLowerCase('vi'));

              return (
                <View>
                  {(newDay || newTime) && (
                    <View style={styles.divider}>
                      <Text style={styles.dividerText}>
                        {newDay ? `${dateDivider(m.createdAt)} · ` : ''}
                        {timeLabel(m.createdAt)}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.messageRow,
                      mine ? styles.outRow : styles.inRow,
                      !grouped && styles.groupStart,
                    ]}
                  >
                    {!mine && (
                      <View style={styles.avatarSlot}>
                        {groupEnd && (
                          <Avatar
                            name={senderName}
                            avatarUrl={senderProfile?.avatarUrl}
                            size={28}
                          />
                        )}
                      </View>
                    )}
                    <View
                      style={[styles.messageColumn, mine && styles.ownColumn]}
                    >
                      {isGroup && !mine && !grouped && (
                        <Text style={styles.senderLabel}>{senderName}</Text>
                      )}
                      <Pressable
                        onLongPress={() => {
                          if (!m.recalled && !sending && !failed) {
                            setActionEntry([key, m]);
                          }
                        }}
                        onPress={() => {
                          if (m.recalled) {
                            return;
                          }
                          if (m.type === 'image' && m.imageUrl) {
                            setViewerUrl(m.imageUrl);
                          } else if (m.type === 'location') {
                            Linking.openURL(
                              `https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}`,
                            ).catch(() =>
                              Alert.alert('Không mở được Google Maps'),
                            );
                          } else {
                            setSelected(selected === key ? null : key);
                          }
                        }}
                        style={[
                          styles.bubble,
                          mine ? styles.out : styles.in,
                          grouped && (mine ? styles.joinOut : styles.joinIn),
                          failed && styles.failedBubble,
                          m.recalled && styles.recalledBubble,
                          (m.type === 'location' || m.type === 'image') &&
                            !m.recalled &&
                            styles.mediaBubble,
                          highlighted && styles.highlightBubble,
                        ]}
                      >
                        {m.replyTo && !m.recalled && (
                          <Pressable
                            style={[
                              styles.replyQuote,
                              mine ? styles.replyQuoteOut : styles.replyQuoteIn,
                            ]}
                            onPress={() => scrollToMessageId(m.replyTo!.id)}
                          >
                            <Text
                              style={[
                                styles.replyAuthor,
                                mine && styles.white,
                              ]}
                            >
                              {m.replyTo.senderName}
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.replySnippet,
                                mine && styles.whiteMuted,
                              ]}
                            >
                              {m.replyTo.text}
                            </Text>
                          </Pressable>
                        )}

                        {m.recalled ? (
                          <Text style={styles.recalledText}>
                            Tin nhắn đã được thu hồi
                          </Text>
                        ) : m.type === 'image' ? (
                          <View style={styles.imageWrap}>
                            <Image
                              source={{ uri: m.imageUrl }}
                              style={styles.messageImage}
                              resizeMode="cover"
                            />
                            {sending && (
                              <View style={styles.imageOverlay}>
                                <ActivityIndicator color="#FFFFFF" size="large" />
                              </View>
                            )}
                          </View>
                        ) : m.type === 'location' ? (
                          <View>
                            <View style={styles.mapPreview}>
                              <View style={styles.mapRoadOne} />
                              <View style={styles.mapRoadTwo} />
                              <View style={styles.mapPin}>
                                <Ionicons
                                  name="location"
                                  size={28}
                                  color={colors.primary}
                                />
                              </View>
                            </View>
                            <View style={styles.locationContent}>
                              <Text style={styles.locationTitle}>
                                Vị trí hiện tại
                              </Text>
                              <Text style={styles.coordinates}>
                                {m.latitude?.toFixed(5)},{' '}
                                {m.longitude?.toFixed(5)}
                              </Text>
                              <View style={styles.mapAction}>
                                <Text style={styles.mapActionText}>
                                  Mở Google Maps
                                </Text>
                                <Ionicons
                                  name="open-outline"
                                  size={15}
                                  color={colors.primary}
                                />
                              </View>
                            </View>
                          </View>
                        ) : (
                          <Text
                            selectable
                            style={[
                              styles.message,
                              mine && styles.white,
                              failed && styles.failedMessage,
                            ]}
                          >
                            {m.text}
                          </Text>
                        )}
                      </Pressable>

                      {reactionList.length > 0 && !m.recalled && (
                        <View
                          style={[
                            styles.reactionBar,
                            mine && styles.reactionBarRight,
                          ]}
                        >
                          {reactionList.map(([emoji, count]) => (
                            <View key={emoji} style={styles.reactionPill}>
                              <Text style={styles.reactionText}>
                                {emoji}
                                {count > 1 ? ` ${count}` : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View
                        style={[styles.messageMeta, mine && styles.metaRight]}
                      >
                        <Text style={styles.time}>
                          {timeLabel(m.createdAt)}
                        </Text>
                        {showStatus && (
                          <MessageStatus
                            state={state}
                            peerName={seenPeerName}
                            peerAvatarUrl={seenPeerAvatar}
                            seenAt={peerReadAt}
                            compact={false}
                            showAvatar={false}
                          />
                        )}
                      </View>

                      {failed && (
                        <View style={styles.retryRow}>
                          <Pressable
                            style={styles.retryButton}
                            onPress={() => retry(key)}
                          >
                            <Ionicons
                              name="refresh-outline"
                              size={14}
                              color={colors.danger}
                            />
                            <Text style={styles.retryText}>Thử lại</Text>
                          </Pressable>
                          <Pressable hitSlop={8} onPress={() => dismiss(key)}>
                            <Ionicons
                              name="close"
                              size={17}
                              color={colors.textMuted}
                            />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
          {!nearBottom && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cuộn đến tin mới nhất"
              style={styles.jump}
              onPress={() => scrollToBottom()}
            >
              <Ionicons name="arrow-down" size={18} color={colors.primary} />
              {newCount > 0 && (
                <Text style={styles.jumpText}>Tin nhắn mới</Text>
              )}
            </Pressable>
          )}
        </View>

        {replyTarget && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerBar} />
            <View style={styles.replyBannerContent}>
              <Text style={styles.replyBannerTitle}>
                Đang trả lời {replyTarget.senderName}
              </Text>
              <Text numberOfLines={1} style={styles.replyBannerText}>
                {replyTarget.text}
              </Text>
            </View>
            <Pressable hitSlop={8} onPress={() => setReplyTarget(null)}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi ảnh"
            style={styles.iconButton}
            onPress={openImageOptions}
          >
            <Ionicons
              name="camera-outline"
              size={26}
              color={colors.primary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi vị trí hiện tại"
            disabled={locating}
            style={styles.iconButton}
            onPress={sendLocation}
          >
            {locating ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons
                name="location-outline"
                size={26}
                color={colors.primary}
              />
            )}
          </Pressable>
          <View style={styles.inputWrap}>
            <TextInput
              accessibilityLabel="Nội dung tin nhắn"
              style={styles.input}
              placeholder="Nhắn tin…"
              placeholderTextColor={colors.textMuted}
              value={draft}
              onChangeText={handleDraftChange}
              maxLength={4000}
              multiline
              onFocus={() => {
                if (bottomRef.current) {
                  requestAnimationFrame(() => scrollToBottom());
                }
              }}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            disabled={!draft.trim()}
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            onPress={sendText}
          >
            <Ionicons
              name="send"
              size={22}
              color={draft.trim() ? 'white' : colors.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Long-press Action Menu */}
      <Modal
        visible={!!actionEntry}
        transparent
        animationType="fade"
        onRequestClose={() => setActionEntry(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setActionEntry(null)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.emojiRow}>
              {REACTIONS.map(emoji => {
                const activeEmoji = actionEntry?.[1].reactions?.[uid] === emoji;
                return (
                  <Pressable
                    key={emoji}
                    style={[
                      styles.emojiBtn,
                      activeEmoji && styles.emojiBtnActive,
                    ]}
                    onPress={() => handleReaction(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.actionList}>
              <Pressable style={styles.actionItem} onPress={handleReply}>
                <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
                <Text style={styles.actionLabel}>Trả lời</Text>
              </Pressable>
              {actionEntry?.[1].type === 'text' && (
                <Pressable style={styles.actionItem} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={20} color={colors.text} />
                  <Text style={styles.actionLabel}>Sao chép</Text>
                </Pressable>
              )}
              {actionEntry?.[1].senderId === uid && (
                <Pressable style={styles.actionItem} onPress={handleRecall}>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.danger}
                  />
                  <Text style={[styles.actionLabel, { color: colors.danger }]}>
                    Thu hồi
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Full-screen Image Viewer */}
      <Modal
        visible={!!viewerUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUrl(null)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable
            style={styles.viewerClose}
            onPress={() => setViewerUrl(null)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {viewerUrl && (
            <Image
              source={{ uri: viewerUrl }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Group Management Modal (Part C) */}
      {isGroup && chat && (
        <GroupInfoModal
          visible={groupModalVisible}
          onClose={() => setGroupModalVisible(false)}
          onLeftGroup={() => navigation.goBack()}
          convId={convId}
          conversation={chat}
          uid={uid}
          ownName={ownName}
          users={users}
          presence={presence}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
  },
  iconButton: {
    minWidth: 38,
    minHeight: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1, marginLeft: 2, gap: 2 },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  headerStatus: { fontSize: 12, color: colors.textMuted },
  searchPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 4 },
  searchJumpBtn: {
    backgroundColor: colors.softBlue,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  searchCount: { fontSize: 12, fontWeight: '700', color: colors.primary },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  noticeText: { fontSize: 12, color: colors.textMuted, flex: 1, lineHeight: 18 },
  list: { paddingHorizontal: 14, paddingBottom: 16 },
  loaderTop: { paddingVertical: 16, alignItems: 'center' },
  profile: { alignItems: 'center', paddingTop: 24, paddingBottom: 18, gap: 6 },
  profileName: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 4 },
  profileSubtitle: { fontSize: 13, color: colors.textMuted },
  systemRow: { alignItems: 'center', marginVertical: 10 },
  systemText: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  divider: { alignItems: 'center', paddingTop: 14, paddingBottom: 14 },
  dividerText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  outRow: { justifyContent: 'flex-end', paddingLeft: 44 },
  inRow: { justifyContent: 'flex-start', paddingRight: 36 },
  groupStart: { marginTop: 10 },
  avatarSlot: { width: 34, paddingBottom: 22, alignItems: 'flex-start' },
  messageColumn: { maxWidth: '88%', alignItems: 'flex-start' },
  ownColumn: { alignItems: 'flex-end' },
  senderLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 3,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 40,
    elevation: 1,
  },
  out: { backgroundColor: colors.bubbleOut, borderBottomRightRadius: 4 },
  in: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  joinOut: { borderTopRightRadius: 4 },
  joinIn: { borderTopLeftRadius: 4 },
  highlightBubble: { borderWidth: 2, borderColor: '#F59E0B' },
  recalledBubble: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  recalledText: { fontSize: 14, fontStyle: 'italic', color: colors.textMuted },
  message: { fontSize: 15, lineHeight: 22, color: colors.text },
  white: { color: '#FFFFFF' },
  whiteMuted: { color: 'rgba(255,255,255,0.8)' },
  failedBubble: {
    backgroundColor: '#FFF0EE',
    borderWidth: 1,
    borderColor: '#F5C2BC',
  },
  failedMessage: { color: colors.danger },
  mediaBubble: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    width: 230,
  },
  imageWrap: { width: 230, height: 230, position: 'relative' },
  messageImage: { width: 230, height: 230 },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  replyQuoteOut: {
    borderLeftColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  replyQuoteIn: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.softBlue,
  },
  replyAuthor: { fontSize: 11.5, fontWeight: '700', color: colors.primary },
  replySnippet: { fontSize: 12, color: colors.textMuted },
  reactionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reactionBarRight: { justifyContent: 'flex-end' },
  reactionPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    elevation: 1,
  },
  reactionText: { fontSize: 12 },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
    marginBottom: 2,
    paddingHorizontal: 4,
    minHeight: 18,
  },
  metaRight: { justifyContent: 'flex-end', flexWrap: 'wrap' },
  time: { fontSize: 10, color: colors.textMuted },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
  },
  retryText: { fontSize: 12, fontWeight: '600', color: colors.danger },
  mapPreview: {
    height: 96,
    backgroundColor: '#E2EFE9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mapRoadOne: {
    position: 'absolute',
    height: 12,
    width: 300,
    backgroundColor: 'white',
    transform: [{ rotate: '-24deg' }],
  },
  mapRoadTwo: {
    position: 'absolute',
    height: 150,
    width: 10,
    backgroundColor: 'white',
    transform: [{ rotate: '-28deg' }],
  },
  mapPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 3,
  },
  locationContent: { padding: 14, gap: 5 },
  locationTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  coordinates: { fontSize: 12, color: colors.textMuted },
  mapAction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  mapActionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyBannerBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  replyBannerContent: { flex: 1 },
  replyBannerTitle: { fontSize: 12, fontWeight: '700', color: colors.primary },
  replyBannerText: { fontSize: 13, color: colors.textMuted },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    maxHeight: 132,
  },
  input: {
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.text,
    maxHeight: 132,
  },
  send: {
    height: 42,
    width: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginLeft: 2,
  },
  sendDisabled: { backgroundColor: colors.surfaceAlt },
  jump: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    minHeight: 42,
    paddingHorizontal: 16,
    elevation: 4,
  },
  jumpText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around' },
  emojiBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emojiBtnActive: {
    backgroundColor: colors.softBlue,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  emojiText: { fontSize: 24 },
  actionList: { gap: 4 },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: 44,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  viewerImage: { width: '100%', height: '85%' },
});
