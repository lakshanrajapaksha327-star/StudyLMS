# StudyLMS Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. Every private document (`notebooks`, `documents`, `document_chunks`, `document_blobs`, `study_notes`, `note_versions`, `flashcard_sets`, `quiz_sets`, `quiz_attempts`, `chat_sessions`, `study_plans`, `study_tasks`, `notifications`, `search_history`, `recent_documents`, `ai_usage_logs`, `activity_logs`) MUST include a valid `userId` equal to `request.auth.uid` on creation and MUST keep `userId` immutable on update.
2. Users may only read or mutate their own `/users/{userId}` and `/user_preferences/{userId}` documents (`userId == request.auth.uid`), and non-admins cannot elevate their own `role` or `status`.
3. Every document ID path variable must match `^[a-zA-Z0-9_-]+$` and be <= 128 characters.
4. Every `list` query rule explicitly enforces `resource.data.userId == request.auth.uid` (no blanket `isSignedIn()` list access and no `get()` inside `allow list`).
5. Every `create` validates exact required and allowed field keys (`hasAll` + `hasOnly`), and every `update` begins with the entity validation helper and restricts mutated keys with `affectedKeys().hasOnly(...)`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/notebooks/nb-1` -> DENIED.
2. User B reading User A's `/documents/doc-1` -> DENIED.
3. User B listing `/document_chunks` without `where('userId', '==', uidB)` -> DENIED.
4. User A creating `/notebooks/nb-2` with `userId: uidB` (identity spoofing) -> DENIED.
5. User A updating `/users/{uidA}` with `{ role: 'Admin' }` (privilege escalation) -> DENIED.
6. User A creating `/notebooks/nb-2` with an extra shadow field `{ isVerified: true }` -> DENIED.
7. User A updating `/documents/doc-1` to mutate immutable `userId` -> DENIED.
8. User A creating `/notebooks/..%2Fadmin` (invalid document ID poisoning) -> DENIED.
9. User A updating `/study_notes/note-1` with a 1MB oversized title string -> DENIED.
10. User A deleting User B's `/chat_sessions/chat-1` -> DENIED.
11. User A reading `/ai_usage_logs` of User B -> DENIED.
12. User A writing to `/admins/{uidA}` without existing admin privileges -> DENIED.
