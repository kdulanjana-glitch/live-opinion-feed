# Live Opinion Feed — Session Handoff

## Active Bug To Fix First

### Feed screen content goes under the Android status bar

**Screenshot**: Category pill ("Life"), LIVE badge, and gear icon all start behind the system
status bar (clock/signal row at the top of the phone).

**Root cause**  
`styles.screen` in `src/screens/FeedScreen.jsx` has `flex: 1` with **no `paddingTop`**.
A previous fix removed `paddingTop` from the screen View to avoid a double-count with the
`onLayout` measurement. That solved the card-height/scroll issue but left the top of the
FlatList flush against the status bar.

The `cardTop` style currently adds `paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44`
as padding **inside** the card, but the card container itself starts at y=0 (behind the status bar).

**Exact fix needed** — in `src/screens/FeedScreen.jsx`:

```js
// CHANGE this:
screen: {
  flex: 1,
},

// TO this:
screen: {
  flex: 1,
  paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
},
```

Then **remove** the duplicate `paddingTop` from `cardTop` (it was only a workaround):

```js
// CHANGE this:
cardTop: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44,
},

// TO this:
cardTop: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
```

The `onLayout` on the FlatList (not on the screen View) ensures the card height equals the
FlatList's rendered height — which is now screen height minus the status bar padding. This
is correct.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 56 + React Native 0.85 |
| Navigation | Custom tab system in `src/app/index.tsx` (NOT expo-router tabs) |
| Auth + DB | Supabase (`@supabase/supabase-js` v2) |
| Storage | AsyncStorage for session persistence |
| Deep links | `expo-linking` + Supabase PKCE flow |
| App scheme | `liveopinionfeed` (set in `app.json`) |

---

## File Structure

```
src/
  app/
    _layout.tsx          — SafeAreaProvider + deep-link handler for password reset
    index.tsx            — Root: tab state, auth state, navigation orchestration
  screens/
    FeedScreen.jsx       — TikTok-style vertical FlatList feed (main screen)
    TrendingScreen.jsx   — Top 10 opinions per category
    CreateScreen.jsx     — Create new opinion form
    SavedScreen.jsx      — Saved opinions list
    ProfileScreen.jsx    — User profile, stats, badges
    AuthScreen.jsx       — Login / signup / forgot / reset-password
    UserProfileScreen.jsx — View another user's opinions
    ScreenWrapper.jsx    — Legacy 9:16 wrapper (no longer used by any screen)
  lib/
    supabase.js          — Supabase client + subscribeToTable() helper
supabase/
  migration.sql          — ALTER TABLE opinions ADD COLUMN description TEXT
scripts/
  seed-admin.js          — Creates admin user + 25 seed opinions (node scripts/seed-admin.js)
```

---

## Supabase Tables Used

| Table | Purpose |
|---|---|
| `opinions` | Main content. Columns: id, text, description, category, created_by, status, agree_count, disagree_count, total_votes, like_count, save_count, comment_count |
| `users` | User profiles. Columns: id, username |
| `votes` | One row per user per opinion per day. Columns: user_id, opinion_id, vote_value, voted_date |
| `opinion_likes` | Columns: user_id, opinion_id |
| `opinion_saves` | Columns: user_id, opinion_id |
| `opinion_comments` | Columns: id, user_id, opinion_id, text, created_at |
| `user_badges` | Columns: user_id, badge_type |

**Important**: Table names differ from what the build plan described. The actual names above
are what the code uses. Do not rename them.

---

## Categories (13 total)

```
love, money, life, tech, society,
politics, food, health, sports,
entertainment, science, education, environment
```

All three screens (FeedScreen, TrendingScreen, CreateScreen) use the same 13 categories.

---

## Navigation Architecture

All navigation is managed in `src/app/index.tsx` via `activeTab` state.
There is **no** expo-router file-based routing in use — the `_layout.tsx` is only a
SafeAreaProvider + deep-link wrapper.

### Tab keys
```
feed | trending | create | saved | profile | auth | reset-password
```
`auth` and `reset-password` are hidden tabs (not shown in the tab bar).

### Guest mode
- Feed and Trending are visible without login.
- Any interaction (like/save/comment/vote/share/avatar tap) calls `onRequireAuth()` → navigates to `auth` tab.
- Create, Saved, Profile tabs redirect guests to `auth` tab automatically.

### `activeTabRef` (critical)
`onAuthStateChange` runs inside a `useEffect([], [])` closure that would otherwise capture
a stale `activeTab`. The fix: `activeTabRef` is a `useRef` kept in sync via `goToTab()`.
**Always use `goToTab(tab)` instead of `setActiveTab(tab)` in `index.tsx`.**

### Cross-screen navigation
- `onNavigateToUser(userId)` — sets `userProfileId` state → renders `UserProfileScreen` overlay
- `onNavigateToFeed(opinionId)` — sets `feedScrollToId` + switches to feed tab
- FeedScreen places target opinion at index 0 of the list (no offset calculation needed)

---

## Auth Flow

### Login
1. AuthScreen calls `supabase.auth.signInWithPassword()`
2. Supabase fires `SIGNED_IN` on `onAuthStateChange` in `index.tsx`
3. `setSession(session)` + `goToTab(prevTabRef.current || 'feed')`

### Signup
1. AuthScreen calls `supabase.auth.signUp()`
2. If `data.session` returned → email confirmation disabled → logged in automatically
3. If no session → email confirmation enabled → show "check your email" message

### Password reset
1. AuthScreen calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'liveopinionfeed://auth' })`
2. User clicks email link on their phone → OS opens app via deep link
3. `_layout.tsx` extracts `?code=` from URL → calls `supabase.auth.exchangeCodeForSession(code)`
4. Supabase fires `PASSWORD_RECOVERY` on `onAuthStateChange`
5. `index.tsx` → `goToTab('reset-password')`
6. AuthScreen rendered with `initialMode="reset-password"` → two password fields
7. Submit calls `supabase.auth.updateUser({ password: newPassword })`
8. `SIGNED_IN` fires → user lands on feed

---

## FeedScreen Architecture

### Card system
- `pagingEnabled` FlatList — each swipe moves exactly one card
- `onLayout` on the **FlatList itself** (not the screen View) sets `listHeight`
- Each card container: `height: itemHeight` where `itemHeight = listHeight > 0 ? listHeight : SH`
- `listHeight` initialises to **0** so the scroll-to-opinion logic waits for the real measurement

### Per-card state
`cardStates` is a `{ [opinionId]: { userVote, liked, saved } }` map.
Updated by `fetchCardState()` when a card becomes visible (`onViewableItemsChanged`).
**Must pass `extraData={cardStates}` to FlatList** — without it, icon styles don't update.

### Realtime
Two Supabase channels:
- `feed-inserts` — prepends new approved opinions to the list
- `feed-updates` — merges `UPDATE` payloads to update counts

### Navigate-to-opinion (from Saved/Trending)
`fetchOpinions()` checks `pendingScrollRef.current`. If set, moves the target opinion to
index 0 of the list before calling `setDisplayOpinions()`. FlatList always starts at offset 0
so the opinion is immediately visible — no `scrollToOffset` calculation needed.

---

## Known Issues / Remaining Work

| Priority | Issue | Location | Notes |
|---|---|---|---|
| 🔴 Fix now | Feed content under status bar | FeedScreen.jsx | See top of this doc |
| 🟡 Config | Signup email not delivered | Supabase dashboard | Configure SMTP (SendGrid/Resend). Free tier: 3 emails/hour |
| 🟡 Config | Email confirmation setting | Supabase dashboard | Auth → Settings → Enable/disable email confirmation |
| 🟢 Enhancement | Share button is a stub | FeedScreen.jsx `handleShare` | Implement `Share.share()` from react-native |
| 🟢 Enhancement | Avatar shows "?" for seed opinions | FeedScreen.jsx | Seed opinions use `created_by` UUID not joined username; fix seed or add join |

---

## Seed Data (Admin Account)

- **Email**: admin@liveopinionfeed.com  
- **Password**: Admin@LiveFeed2025!  
- **Run**: `node scripts/seed-admin.js` (requires `SUPABASE_SERVICE_ROLE_KEY` in `.env`)
- **Pre-requisite**: Run `supabase/migration.sql` in Supabase SQL Editor first

---

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=         # in .env already
EXPO_PUBLIC_SUPABASE_ANON_KEY=    # in .env already
SUPABASE_SERVICE_ROLE_KEY=        # add this for seed script only
```

---

## How to Run

```bash
npx expo start          # normal start
npx expo start --clear  # clear Metro cache (use after multiple file changes)
```

Scan QR with Expo Go on Android. Same QR works after JS-only changes (Fast Refresh).
Rescan required after: adding native packages, changing app.json, or after --clear.
