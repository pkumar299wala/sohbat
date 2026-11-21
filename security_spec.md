# SOHBAT Security Specification (Phase 0 TDD)

## 1. Core Data Invariants
1. **PII Isolation**: Email addresses and phone numbers reside strictly in `/users_private/{userId}` and are readable/writable ONLY by `request.auth.uid == userId`. No Chela can ever read another Chela's phone number or email.
2. **Host Authority**: Only the Darbar creator (`hostUid == request.auth.uid`) can create/update/lock/end a Darbar, admit or reject users in `pratiksha`, mute/remove participants, or access `recordings` (Smriti).
3. **Waiting Room Gate (Pratiksha Kaksh)**: A Chela cannot write their own `participants/{uid}` document directly unless they are the room's `hostUid` OR their `pratiksha/{uid}` document has `status == 'admitted'`.
4. **No Plaintext Passwords**: Darbar `Gupt Mantra` passwords are stored strictly as salted SHA-256 hashes (`passwordHash`), never plain text.
5. **Ephemeral Chat & Temp Cleanup**: Arz chat messages belong strictly to an existing Darbar room, enforce immutable `senderUid == request.auth.uid`, and are batch-deleted by the Host when the Darbar ends.
6. **Verified Identity**: All mutations require `request.auth != null` and either verified email (`email_verified == true`) or Phone OTP (`phone_number != null`).

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Darbar Creation**: `auth = null` creating `/darbars/room_1` -> DENIED.
2. **Identity Spoofing on Darbar Create**: User `chela_1` creating `/darbars/room_2` with `hostUid: 'guru_99'` -> DENIED.
3. **Shadow Field Injection (Ghost Field)**: Guru creating `/darbars/room_3` with extra field `isAdminVerified: true` -> DENIED (`keys().hasOnly(...)`).
4. **Path ID Poisoning**: Creating `/darbars/room_with_1500_chars...` or invalid chars `$bad!id` -> DENIED (`isValidId`).
5. **PII Cross-Read**: User `chela_1` reading `/users_private/chela_2` -> DENIED.
6. **PII Directory Scraping**: Any user listing `/users_private` or `/users_public` -> DENIED (`allow list: if false`).
7. **Self-Admission Bypass**: User `chela_1` updating their own `/darbars/room_1/pratiksha/chela_1` status from `'waiting'` to `'admitted'` -> DENIED.
8. **Chela Locking Room**: Non-host `chela_1` updating `/darbars/room_1` `isLocked: true` or `muteAllActive: true` -> DENIED.
9. **Terminal State Mutation**: Host attempting to revert a `'ended'` Darbar back to `'live'` -> DENIED (Terminal State Lock).
10. **Chat Sender Spoofing**: User `chela_1` posting `/darbars/room_1/chat/msg_1` with `senderUid: 'guru_1'` and `senderRole: 'guru'` -> DENIED.
11. **Value Poisoning / Oversized Payload**: Sending 50KB chat message in `text` field -> DENIED (`text.size() <= 1000`).
12. **Unauthorized Smriti Recording Access**: Chela reading or downloading `/recordings/rec_1` where `hostUid != request.auth.uid` -> DENIED.
