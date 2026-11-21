/**
 * SOHBAT Firestore Security Rules Verification Suite (Phase 0 TDD)
 * Run against Firebase Emulator with @firebase/rules-unit-testing when testing locally.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  authUid: string | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Darbar Create',
    collectionPath: 'darbars/room_1',
    operation: 'create',
    authUid: null,
    payload: { roomId: 'room_1', roomCode: 'SOHBAT-1234', hostUid: 'anon' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on Darbar Create',
    collectionPath: 'darbars/room_2',
    operation: 'create',
    authUid: 'chela_1',
    payload: { roomId: 'room_2', roomCode: 'SOHBAT-9999', hostUid: 'guru_99', title: 'Spoofed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection',
    collectionPath: 'darbars/room_3',
    operation: 'create',
    authUid: 'guru_1',
    payload: { roomId: 'room_3', hostUid: 'guru_1', isAdminVerified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Path ID Poisoning',
    collectionPath: 'darbars/invalid$id!with*bad^chars',
    operation: 'create',
    authUid: 'guru_1',
    payload: { roomId: 'invalid$id!with*bad^chars', hostUid: 'guru_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'PII Cross-Read',
    collectionPath: 'users_private/chela_2',
    operation: 'get',
    authUid: 'chela_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'PII Directory Scraping',
    collectionPath: 'users_private',
    operation: 'list',
    authUid: 'chela_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Self-Admission Bypass in Pratiksha',
    collectionPath: 'darbars/room_1/pratiksha/chela_1',
    operation: 'update',
    authUid: 'chela_1',
    payload: { status: 'admitted' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Chela Locking Room',
    collectionPath: 'darbars/room_1',
    operation: 'update',
    authUid: 'chela_1',
    payload: { isLocked: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal State Mutation on Ended Darbar',
    collectionPath: 'darbars/room_ended',
    operation: 'update',
    authUid: 'guru_1',
    payload: { status: 'live' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Chat Sender Spoofing',
    collectionPath: 'darbars/room_1/chat/msg_1',
    operation: 'create',
    authUid: 'chela_1',
    payload: { id: 'msg_1', senderUid: 'guru_1', senderRole: 'guru', text: 'Fake Guru' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning Oversized Chat',
    collectionPath: 'darbars/room_1/chat/msg_2',
    operation: 'create',
    authUid: 'chela_1',
    payload: { id: 'msg_2', senderUid: 'chela_1', senderRole: 'chela', text: 'x'.repeat(5000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Smriti Recording Read',
    collectionPath: 'recordings/rec_1',
    operation: 'get',
    authUid: 'chela_1',
    expected: 'PERMISSION_DENIED',
  },
];
