/**
 * Soli Medical MICU (ICU-Sync)
 * Cloud Functions for Firebase (Callable Admin Operations)
 * 
 * Provides secure callable HTTPS Cloud Functions:
 * - disableUserCallable
 * - deleteUserCallable
 */

import { disableUser, deleteUser } from '../src/server/adminOperations';

export async function disableUserCallable(data: { targetUid: string; reason?: string }, context: { auth?: { uid: string } }) {
  if (!context.auth?.uid) {
    throw new Error('Unauthenticated: Calling user must be signed in.');
  }
  return await disableUser(context.auth.uid, data.targetUid, data.reason);
}

export async function deleteUserCallable(data: { targetUid: string; reason?: string }, context: { auth?: { uid: string } }) {
  if (!context.auth?.uid) {
    throw new Error('Unauthenticated: Calling user must be signed in.');
  }
  return await deleteUser(context.auth.uid, data.targetUid, data.reason);
}
