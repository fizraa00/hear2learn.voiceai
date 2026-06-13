# Hear2Learn Security Specifications

This specification outlines the data invariants and access controls for the Hear2Learn Firestore database.

## 1. Data Invariants
- **User Integrity**: A user can only access, create, or update their own profile `/users/{userId}`.
- **Relational Consistency**: Progress records, quiz records, and study materials can only be created under a path that matches the current authenticated user's ID.
- **Timestamp Integrity**: All creation/update actions must enforce strict server-side timestamps (`request.time`).
- **Boundaries**: String sizes must be strictly bounded, and lists (such as `masteredConcepts` or `weakTopics`) must be capped in size (typically <= 10 items) to prevent denial-of-wallet memory attacks.
- **Immutability**: Field values like `userId` or `createdAt` cannot be altered post-creation.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following malicious scenarios must be strictly blocked by the Firestore rules, returning `PERMISSION_DENIED`:

1. **Anonymous Read Profile**: Non-authenticated caller attempts to query the user table.
2. **Identity Spoofing (Create Profile)**: Authenticated user `user_abc` attempts to create profile `/users/user_xyz`.
3. **Identity Spoofing (Update Other)**: Authenticated user `user_abc` attempts to modify `/users/user_xyz`.
4. **State Poisoning (Negative Study Time)**: User tries to set negative `totalStudyTime` or excessively large value.
5. **Privilege Escalation**: Standard user tries to write system-level configs.
6. **Relational Leakage (Get Material)**: User `user_abc` attempts to pull parsed study material from `/users/user_xyz/materials/doc_1`.
7. **Relational Leakage (List Quizzes)**: User `user_abc` attempts to query `/users/user_xyz/quizzes`.
8. **Shadow Field Injection**: User tries to write a ghost tag `isAdmin: true` during profile insertion.
9. **Creation Timestamp Override**: User tries to pass a client-side date for `createdAt` instead of `request.time`.
10. **Array Flooding Attack**: User attempts to save a quiz record with more than 100 values in `weakAreasDetected` array.
11. **State Slip**: User tries to update an immutable field `userId` after creation.
12. **Malicious ID Injection**: User attempts to inject a long, nested directory string or malicious characters as a document ID (e.g. using `../../nested_id`).

---

## 3. Database Security Invariant Mapping

We define our Fortress Rules to deny all reads and writes by default, and only allow highly structured attribute-based accesses. Let's list the collection validations in our upcoming `firestore.rules`:
* `match /users/{userId}`: Only accessible by authenticated `userId` where `request.auth.uid == userId`.
* `match /users/{userId}/progress/{progressId}`: Only writeable/readable if `request.auth.uid == userId`.
* `match /users/{userId}/quizzes/{quizId}`: Only writeable/readable block if `request.auth.uid == userId`.
* `match /users/{userId}/materials/{materialId}`: Restricted strictly to the material owner.
