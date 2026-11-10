# Security Specification

## Data Invariants
1. Users may only read and write their own profile document (`/users/{userId}` where `request.auth.uid == userId`).
2. Users cannot alter their `userId` or impersonate other users.
3. Bookmarks and exam results are strictly scoped to the authenticated user under `/users/{userId}/bookmarks/{bookmarkId}` and `/users/{userId}/examResults/{resultId}`.
4. Designated Admin (`sezgin45efe@gmail.com`) is granted strictly READ-ONLY viewing permissions to list user profiles and observe platform analytics. Admin has ZERO write, update, or delete privileges.
5. Default-deny on all unspecified routes.

## Dirty Dozen Payloads (Rejection Scenarios)
1. Unauthenticated user trying to read `/users/user123` -> PERMISSION_DENIED.
2. User A trying to read User B's profile `/users/userB` -> PERMISSION_DENIED.
3. User A trying to update User B's bookmarks `/users/userB/bookmarks/bm1` -> PERMISSION_DENIED.
4. User A trying to write a profile with spoofed `userId: "userB"` -> PERMISSION_DENIED.
5. User trying to write to root catch-all `/any_collection/doc1` -> PERMISSION_DENIED.
6. User trying to inject oversize payload (> 1000 characters) in name or email -> PERMISSION_DENIED.
7. Unauthenticated user attempting to list `/users/{userId}/examResults` -> PERMISSION_DENIED.
8. User trying to delete another user's exam result -> PERMISSION_DENIED.
9. Invalid document ID characters or ID poisoning in path -> PERMISSION_DENIED.
10. Attempt to modify immutable `userId` field on update -> PERMISSION_DENIED.
11. User trying to set arbitrary admin claims or extra fields without permission -> PERMISSION_DENIED.
12. Attempt to write negative question counts in exam results -> PERMISSION_DENIED.
