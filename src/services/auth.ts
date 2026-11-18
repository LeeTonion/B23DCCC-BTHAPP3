import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { auth, db, firebaseAuth } from './firebase';
export type AuthUser = User;
export function watchAuth(next: (user: User | null) => void) {
  return auth ? onAuthStateChanged(auth, next) : undefined;
}
export async function authenticateAccount(
  email: string,
  password: string,
  name?: string,
) {
  const credential = name
    ? await createUserWithEmailAndPassword(
        firebaseAuth(),
        email.trim(),
        password,
      )
    : await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
  if (name) {
    await updateProfile(credential.user, { displayName: name.trim() });
  }
  await update(ref(db(), `users/${credential.user.uid}`), {
    name: credential.user.displayName || email.trim().split('@')[0],
  });
  return credential.user;
}
export async function updateUserProfile(
  uid: string,
  updates: { name?: string; avatarUrl?: string },
) {
  const clean: Record<string, string> = {};
  if (updates.name?.trim()) {
    clean.name = updates.name.trim();
  }
  if (updates.avatarUrl) {
    clean.avatarUrl = updates.avatarUrl;
  }
  if (Object.keys(clean).length === 0) {
    return;
  }
  const current = firebaseAuth().currentUser;
  if (current && current.uid === uid) {
    await updateProfile(current, {
      ...(clean.name ? { displayName: clean.name } : {}),
      ...(clean.avatarUrl ? { photoURL: clean.avatarUrl } : {}),
    });
  }
  await update(ref(db(), `users/${uid}`), clean);
}
export const logoutAccount = () => signOut(firebaseAuth());
