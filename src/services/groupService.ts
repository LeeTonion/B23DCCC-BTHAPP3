import { increment, push, ref, serverTimestamp, update } from 'firebase/database';
import { createMessageId } from './chat';
import { db } from './firebase';
import { createNotification } from './notificationService';

export async function createGroup(params: {
  name: string;
  creatorUid: string;
  creatorName: string;
  memberUids: string[];
}): Promise<string> {
  const { name, creatorUid, creatorName, memberUids } = params;
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Vui lòng nhập tên nhóm.');
  }
  const uniqueMembers = Array.from(new Set([creatorUid, ...memberUids]));
  if (uniqueMembers.length < 3) {
    throw new Error('Nhóm cần ít nhất 2 thành viên ngoài bản thân.');
  }

  const convRef = push(ref(db(), 'conversations'));
  const convId = convRef.key;
  if (!convId) {
    throw new Error('Không tạo được mã nhóm.');
  }

  const msgId = createMessageId();
  const sysText = `${creatorName} đã tạo nhóm "${trimmed}"`;
  const membersMap: Record<string, boolean> = {};
  uniqueMembers.forEach(uid => {
    membersMap[uid] = true;
  });

  const updates: Record<string, unknown> = {
    [`conversations/${convId}`]: {
      type: 'group',
      name: trimmed,
      members: membersMap,
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    },
    [`messages/${convId}/${msgId}`]: {
      senderId: creatorUid,
      type: 'system',
      text: sysText,
      createdAt: serverTimestamp(),
    },
  };

  uniqueMembers.forEach(mUid => {
    updates[`userChats/${mUid}/${convId}/lastMessage`] = sysText;
    updates[`userChats/${mUid}/${convId}/lastSenderId`] = creatorUid;
    updates[`userChats/${mUid}/${convId}/updatedAt`] = serverTimestamp();
    updates[`userChats/${mUid}/${convId}/unread`] =
      mUid === creatorUid ? 0 : increment(1);
  });

  await update(ref(db()), updates);

  await Promise.all(
    uniqueMembers
      .filter(mUid => mUid !== creatorUid)
      .map(mUid =>
        createNotification(mUid, {
          type: 'group_add',
          convId,
          fromUid: creatorUid,
          text: `${creatorName} đã thêm bạn vào nhóm "${trimmed}"`,
        }).catch(() => {}),
      ),
  );

  return convId;
}

export async function renameGroup(params: {
  convId: string;
  newName: string;
  actorUid: string;
  actorName: string;
  memberUids: string[];
}) {
  const { convId, newName, actorUid, actorName, memberUids } = params;
  const trimmed = newName.trim();
  if (!trimmed) {
    throw new Error('Tên nhóm không được để trống.');
  }
  const msgId = createMessageId();
  const sysText = `${actorName} đã đổi tên nhóm thành "${trimmed}"`;
  const updates: Record<string, unknown> = {
    [`conversations/${convId}/name`]: trimmed,
    [`messages/${convId}/${msgId}`]: {
      senderId: actorUid,
      type: 'system',
      text: sysText,
      createdAt: serverTimestamp(),
    },
  };
  memberUids.forEach(mUid => {
    updates[`userChats/${mUid}/${convId}/lastMessage`] = sysText;
    updates[`userChats/${mUid}/${convId}/lastSenderId`] = actorUid;
    updates[`userChats/${mUid}/${convId}/updatedAt`] = serverTimestamp();
    if (mUid !== actorUid) {
      updates[`userChats/${mUid}/${convId}/unread`] = increment(1);
    }
  });
  await update(ref(db()), updates);
}

export async function addGroupMembers(params: {
  convId: string;
  groupName: string;
  newMembers: Array<{ uid: string; name: string }>;
  actorUid: string;
  actorName: string;
  existingMemberUids: string[];
}) {
  const {
    convId,
    groupName,
    newMembers,
    actorUid,
    actorName,
    existingMemberUids,
  } = params;
  if (!newMembers.length) {
    return;
  }
  const msgId = createMessageId();
  const addedNames = newMembers.map(m => m.name).join(', ');
  const sysText = `${actorName} đã thêm ${addedNames} vào nhóm`;

  const allUids = Array.from(
    new Set([...existingMemberUids, ...newMembers.map(m => m.uid)]),
  );

  const updates: Record<string, unknown> = {
    [`messages/${convId}/${msgId}`]: {
      senderId: actorUid,
      type: 'system',
      text: sysText,
      createdAt: serverTimestamp(),
    },
  };
  newMembers.forEach(m => {
    updates[`conversations/${convId}/members/${m.uid}`] = true;
  });
  allUids.forEach(mUid => {
    updates[`userChats/${mUid}/${convId}/lastMessage`] = sysText;
    updates[`userChats/${mUid}/${convId}/lastSenderId`] = actorUid;
    updates[`userChats/${mUid}/${convId}/updatedAt`] = serverTimestamp();
    if (mUid !== actorUid) {
      updates[`userChats/${mUid}/${convId}/unread`] = increment(1);
    }
  });

  await update(ref(db()), updates);

  await Promise.all(
    newMembers.map(m =>
      createNotification(m.uid, {
        type: 'group_add',
        convId,
        fromUid: actorUid,
        text: `${actorName} đã thêm bạn vào nhóm "${groupName}"`,
      }).catch(() => {}),
    ),
  );
}

export async function removeGroupMember(params: {
  convId: string;
  targetUid: string;
  targetName: string;
  actorUid: string;
  actorName: string;
  remainingMemberUids: string[];
}) {
  const {
    convId,
    targetUid,
    targetName,
    actorUid,
    actorName,
    remainingMemberUids,
  } = params;
  const msgId = createMessageId();
  const sysText = `${actorName} đã xóa ${targetName} khỏi nhóm`;
  const updates: Record<string, unknown> = {
    [`conversations/${convId}/members/${targetUid}`]: null,
    [`userChats/${targetUid}/${convId}`]: null,
    [`messages/${convId}/${msgId}`]: {
      senderId: actorUid,
      type: 'system',
      text: sysText,
      createdAt: serverTimestamp(),
    },
  };
  remainingMemberUids.forEach(mUid => {
    updates[`userChats/${mUid}/${convId}/lastMessage`] = sysText;
    updates[`userChats/${mUid}/${convId}/lastSenderId`] = actorUid;
    updates[`userChats/${mUid}/${convId}/updatedAt`] = serverTimestamp();
    if (mUid !== actorUid) {
      updates[`userChats/${mUid}/${convId}/unread`] = increment(1);
    }
  });
  await update(ref(db()), updates);
}

export async function leaveGroup(params: {
  convId: string;
  uid: string;
  userName: string;
  remainingMemberUids: string[];
}) {
  const { convId, uid, userName, remainingMemberUids } = params;
  const msgId = createMessageId();
  const sysText = `${userName} đã rời nhóm`;
  const updates: Record<string, unknown> = {
    [`conversations/${convId}/members/${uid}`]: null,
    [`userChats/${uid}/${convId}`]: null,
    [`typing/${convId}/${uid}`]: null,
    [`messages/${convId}/${msgId}`]: {
      senderId: uid,
      type: 'system',
      text: sysText,
      createdAt: serverTimestamp(),
    },
  };
  remainingMemberUids.forEach(mUid => {
    updates[`userChats/${mUid}/${convId}/lastMessage`] = sysText;
    updates[`userChats/${mUid}/${convId}/lastSenderId`] = uid;
    updates[`userChats/${mUid}/${convId}/updatedAt`] = serverTimestamp();
    updates[`userChats/${mUid}/${convId}/unread`] = increment(1);
  });
  await update(ref(db()), updates);
}
