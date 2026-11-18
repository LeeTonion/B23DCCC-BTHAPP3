import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

jest.mock('../src/context/AuthContext', () => {
  const user = { uid: 'a', displayName: 'Alice' };
  return { useAuth: () => ({ user }) };
});
jest.mock('../src/services/firebase', () => ({
  errorMessage: (e: Error) => e.message,
}));
jest.mock('../src/services/uploadService', () => ({
  uploadImageToCloudinary: jest.fn(),
}));
jest.mock('../src/services/notificationService', () => ({
  watchNotifications: jest.fn(() => jest.fn()),
  setupLocalNotifications: jest.fn(),
  showLocalNotification: jest.fn(),
}));
jest.mock('../src/services/chat', () => ({
  watchUsers: jest.fn(() => jest.fn()),
  watchPresence: jest.fn(() => jest.fn()),
  watchUserChats: jest.fn(() => jest.fn()),
  watchConversation: jest.fn(() => jest.fn()),
  watchConnection: jest.fn(() => jest.fn()),
  sendMessage: jest.fn(),
  sendConversationMessage: jest.fn(),
  createMessageId: jest.fn(() => '-message1'),
  conversationId: () => 'a_b',
}));

import { ChatProvider, useChatData } from '../src/context/ChatContext';
import {
  sendMessage,
  watchUserChats,
  watchConnection,
  watchPresence,
  watchUsers,
} from '../src/services/chat';
import { watchNotifications } from '../src/services/notificationService';

let value: ReturnType<typeof useChatData>;
let tree: ReactTestRenderer.ReactTestRenderer;

function Probe() {
  value = useChatData();
  return null;
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(sendMessage).mockReset();
  await act(async () => {
    tree = ReactTestRenderer.create(
      <ChatProvider>
        <Probe />
      </ChatProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => tree.unmount());
});

test('keeps optimistic messages sending until acknowledged, then clears outbox', async () => {
  let acknowledge!: () => void;
  jest.mocked(sendMessage).mockImplementation(
    () =>
      new Promise<void>(resolve => {
        acknowledge = resolve;
      }),
  );
  await act(async () => {
    value.send('b', { type: 'text', text: 'Xin chào' });
  });
  expect(value.outbox['-message1'].state).toBe('sending');
  await act(async () => acknowledge());
  expect(value.outbox['-message1']).toBeUndefined();
});

test('preserves a failed message and retries the same ID once despite repeated taps', async () => {
  jest
    .mocked(sendMessage)
    .mockRejectedValueOnce(new Error('Permission denied'));
  await act(async () => {
    value.send('b', { type: 'text', text: 'Gửi lại tôi' });
  });
  expect(value.outbox['-message1'].state).toBe('failed');
  expect(value.outbox['-message1'].error).toBe('Permission denied');
  let acknowledge!: () => void;
  jest.mocked(sendMessage).mockImplementation(
    () =>
      new Promise<void>(resolve => {
        acknowledge = resolve;
      }),
  );
  await act(async () => {
    value.retry('-message1');
    value.retry('-message1');
  });
  expect(sendMessage).toHaveBeenCalledTimes(2);
  expect(jest.mocked(sendMessage).mock.calls[1][3]).toBe('-message1');
  expect(value.outbox['-message1'].state).toBe('sending');
  await act(async () => acknowledge());
  expect(value.outbox['-message1']).toBeUndefined();
});

test('cleans up all realtime subscriptions when leaving the account', async () => {
  const stops = [
    watchUsers,
    watchPresence,
    watchUserChats,
    watchConnection,
    watchNotifications,
  ].map(fn => jest.mocked(fn).mock.results[0].value);
  await act(async () => tree.unmount());
  stops.forEach(stop => expect(stop).toHaveBeenCalledTimes(1));
});
