import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from './firebase';
import { generateRoomCode, generateSafeId, hashGuptMantra } from './crypto';

export type RolePreference = 'guru' | 'chela';
export type DarbarStatus = 'scheduled' | 'live' | 'ended';
export type ActiveMode = 'video' | 'screenshare' | 'whiteboard';
export type RecurrenceType = 'none' | 'daily' | 'weekly';

export interface DarbarRoomDoc {
  roomId: string;
  roomCode: string;
  title: string;
  hostUid: string;
  hostName: string;
  passwordHash?: string;
  hasPassword: boolean;
  status: DarbarStatus;
  isLocked: boolean;
  muteAllActive: boolean;
  activeMode: ActiveMode;
  recordingActive: boolean;
  breakoutActive: boolean;
  scheduledFor?: string;
  recurrence: RecurrenceType;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoomCodeIndexDoc {
  roomCode: string;
  roomId: string;
  hostUid: string;
  title: string;
  hasPassword: boolean;
  status: DarbarStatus;
  createdAt?: unknown;
}

export interface PratikshaDoc {
  uid: string;
  roomId: string;
  hostUid: string;
  displayName: string;
  status: 'waiting' | 'admitted' | 'rejected';
  requestedAt?: unknown;
  updatedAt?: unknown;
}

export interface SmritiRecordingDoc {
  id: string;
  roomId: string;
  roomCode: string;
  title: string;
  hostUid: string;
  storagePath: string;
  durationSec: number;
  createdAt?: unknown;
}

export async function syncUserProfile(user: User, rolePreference: RolePreference = 'chela'): Promise<void> {
  const safeName = (user.displayName || user.phoneNumber || user.email?.split('@')[0] || 'Sadhak').slice(0, 80);
  const publicPath = `users_public/${user.uid}`;
  const privatePath = `users_private/${user.uid}`;

  try {
    const publicPayload: Record<string, unknown> = {
      uid: user.uid,
      displayName: safeName,
      rolePreference,
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      publicPayload.photoURL = user.photoURL.slice(0, 512);
    }
    await setDoc(doc(db, 'users_public', user.uid), publicPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    const existingPrivate = await getDoc(doc(db, 'users_private', user.uid));
    const privatePayload: Record<string, unknown> = {
      uid: user.uid,
      createdAt: existingPrivate.exists() ? existingPrivate.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.email) privatePayload.email = user.email.slice(0, 160);
    if (user.phoneNumber) privatePayload.phoneNumber = user.phoneNumber.slice(0, 32);

    await setDoc(doc(db, 'users_private', user.uid), privatePayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export interface CreateDarbarInput {
  title: string;
  hostUid: string;
  hostName: string;
  mantra?: string;
  scheduledFor?: string;
  recurrence: RecurrenceType;
  startNow: boolean;
}

export async function createDarbar(input: CreateDarbarInput): Promise<DarbarRoomDoc> {
  const roomId = generateSafeId('darbar');
  const roomCode = generateRoomCode();
  const cleanTitle = input.title.trim().slice(0, 120) || 'Satsang Darbar';
  const cleanHostName = input.hostName.trim().slice(0, 80) || 'Guruji';
  const hasPassword = Boolean(input.mantra && input.mantra.trim().length > 0);
  const passwordHash = hasPassword && input.mantra ? await hashGuptMantra(input.mantra) : undefined;
  const status: DarbarStatus = input.startNow ? 'live' : 'scheduled';

  const darbarData: Record<string, unknown> = {
    roomId,
    roomCode,
    title: cleanTitle,
    hostUid: input.hostUid,
    hostName: cleanHostName,
    hasPassword,
    status,
    isLocked: false,
    muteAllActive: false,
    activeMode: 'video',
    recordingActive: false,
    breakoutActive: false,
    recurrence: input.recurrence || 'none',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (passwordHash) {
    darbarData.passwordHash = passwordHash;
  }
  if (input.scheduledFor) {
    darbarData.scheduledFor = input.scheduledFor.slice(0, 64);
  }

  const indexData: Record<string, unknown> = {
    roomCode,
    roomId,
    hostUid: input.hostUid,
    title: cleanTitle,
    hasPassword,
    status,
    createdAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'darbars', roomId), darbarData);
    batch.set(doc(db, 'room_codes', roomCode), indexData);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `darbars/${roomId}`);
  }

  return darbarData as unknown as DarbarRoomDoc;
}

export async function lookupDarbarByCode(roomCode: string): Promise<DarbarRoomDoc | null> {
  const code = roomCode.trim().toUpperCase();
  if (!/^SOHBAT-[A-Z0-9]{4,10}$/.test(code)) {
    return null;
  }

  let indexSnap;
  try {
    indexSnap = await getDoc(doc(db, 'room_codes', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `room_codes/${code}`);
  }

  if (!indexSnap.exists()) return null;
  const indexData = indexSnap.data() as RoomCodeIndexDoc;

  try {
    const roomSnap = await getDoc(doc(db, 'darbars', indexData.roomId));
    if (!roomSnap.exists()) return null;
    return roomSnap.data() as DarbarRoomDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `darbars/${indexData.roomId}`);
  }
}

export async function getDarbarById(roomId: string): Promise<DarbarRoomDoc | null> {
  try {
    const snap = await getDoc(doc(db, 'darbars', roomId));
    if (!snap.exists()) return null;
    return snap.data() as DarbarRoomDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `darbars/${roomId}`);
  }
}

export async function requestPratikshaEntry(
  roomId: string,
  hostUid: string,
  uid: string,
  displayName: string
): Promise<void> {
  const path = `darbars/${roomId}/pratiksha/${uid}`;
  try {
    const existing = await getDoc(doc(db, 'darbars', roomId, 'pratiksha', uid));
    if (existing.exists()) {
      const data = existing.data() as PratikshaDoc;
      if (data.status === 'admitted') return;
    }
    await setDoc(doc(db, 'darbars', roomId, 'pratiksha', uid), {
      uid,
      roomId,
      hostUid,
      displayName: displayName.trim().slice(0, 80) || 'Chela',
      status: 'waiting',
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updatePratikshaStatus(
  roomId: string,
  chelaUid: string,
  status: 'admitted' | 'rejected'
): Promise<void> {
  const path = `darbars/${roomId}/pratiksha/${chelaUid}`;
  try {
    await updateDoc(doc(db, 'darbars', roomId, 'pratiksha', chelaUid), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function registerParticipantInFirestore(
  roomId: string,
  hostUid: string,
  uid: string,
  displayName: string,
  role: 'guru' | 'chela'
): Promise<void> {
  const path = `darbars/${roomId}/participants/${uid}`;
  try {
    await setDoc(doc(db, 'darbars', roomId, 'participants', uid), {
      uid,
      roomId,
      hostUid,
      displayName: displayName.trim().slice(0, 80) || 'Sadhak',
      role,
      isMuted: false,
      isVideoOn: true,
      handRaised: false,
      audioOnly: false,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateDarbarLiveControls(
  roomId: string,
  patch: Partial<Pick<DarbarRoomDoc, 'status' | 'isLocked' | 'muteAllActive' | 'activeMode' | 'recordingActive' | 'breakoutActive'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'darbars', roomId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `darbars/${roomId}`);
  }
}

export async function postArzMessageToFirestore(
  roomId: string,
  hostUid: string,
  senderUid: string,
  senderName: string,
  senderRole: 'guru' | 'chela',
  text: string
): Promise<string> {
  const msgId = generateSafeId('arz');
  const cleanText = text.trim().slice(0, 1000);
  const path = `darbars/${roomId}/chat/${msgId}`;
  try {
    await setDoc(doc(db, 'darbars', roomId, 'chat', msgId), {
      id: msgId,
      roomId,
      hostUid,
      senderUid,
      senderName: senderName.trim().slice(0, 80) || 'Sadhak',
      senderRole,
      text: cleanText,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return msgId;
}

/**
 * Ends Darbar and auto-deletes ephemeral Chat, Pratiksha, and Participant docs from Firestore.
 */
export async function endDarbarAndCleanup(roomId: string, roomCode: string, hostUid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'darbars', roomId), {
      status: 'ended',
      recordingActive: false,
      breakoutActive: false,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'room_codes', roomCode), {
      status: 'ended',
    });

    const subcollections = ['chat', 'pratiksha', 'participants'] as const;
    for (const sub of subcollections) {
      const q = query(collection(db, 'darbars', roomId, sub), where('hostUid', '==', hostUid));
      const snap = await getDocs(q);
      snap.forEach((d) => batch.delete(d.ref));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `darbars/${roomId}`);
  }
}

export async function uploadSmritiRecording(
  hostUid: string,
  roomId: string,
  roomCode: string,
  title: string,
  blob: Blob,
  durationSec: number
): Promise<SmritiRecordingDoc> {
  const recId = generateSafeId('smriti');
  const storagePath = `smriti/${hostUid}/${roomId}/${recId}.webm`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, { contentType: 'video/webm' });

  const recordDoc: Record<string, unknown> = {
    id: recId,
    roomId,
    roomCode,
    title: title.trim().slice(0, 120) || 'Satsang Smriti',
    hostUid,
    storagePath,
    durationSec: Math.max(0, Math.round(durationSec)),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'recordings', recId), recordDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `recordings/${recId}`);
  }

  return recordDoc as unknown as SmritiRecordingDoc;
}

export async function getSmritiDownloadUrl(storagePath: string): Promise<string> {
  return getDownloadURL(ref(storage, storagePath));
}

export async function fetchHostDashboard(hostUid: string): Promise<{
  darbars: DarbarRoomDoc[];
  recordings: SmritiRecordingDoc[];
}> {
  let darbars: DarbarRoomDoc[] = [];
  let recordings: SmritiRecordingDoc[] = [];

  try {
    const qRooms = query(
      collection(db, 'darbars'),
      where('hostUid', '==', hostUid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(qRooms);
    darbars = snap.docs.map((d) => d.data() as DarbarRoomDoc);
  } catch (error) {
    // Fallback without composite index if Firestore index is still building
    try {
      const qFallback = query(collection(db, 'darbars'), where('hostUid', '==', hostUid));
      const snap = await getDocs(qFallback);
      darbars = snap.docs.map((d) => d.data() as DarbarRoomDoc);
    } catch (innerErr) {
      handleFirestoreError(innerErr, OperationType.LIST, 'darbars');
    }
    void error;
  }

  try {
    const qRecs = query(collection(db, 'recordings'), where('hostUid', '==', hostUid));
    const snap = await getDocs(qRecs);
    recordings = snap.docs.map((d) => d.data() as SmritiRecordingDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'recordings');
  }

  return { darbars, recordings };
}
