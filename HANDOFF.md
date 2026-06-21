# Peolia — Session Handoff

**Last updated: 2026-06-20.** App is working end-to-end on device (Android; now a dev build
since `expo-dev-client` was added). Votes, likes, pins, voices, follow, share, profile edit,
view-reacts lock, theming, settings, and in-app notifications all function.

**App-wide providers (in `src/app/_layout.tsx`):**
`SafeAreaProvider → ThemeProvider → NotificationProvider → BlockProvider → ErrorBoundary → AppLockGate → Stack`.

**THEMING:** never import `useColorScheme` from react-native. Use
`const scheme = usePeoliaScheme()` from `src/context/ThemeContext`. It honors the citizen's
manual Light/Dark/System pick (persisted in AsyncStorage `peolia_theme_pref`). ThemeContext.jsx
is the ONLY file allowed to import the raw react-native hook.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 56 + React Native 0.85 + Expo Router v56 (entry only) |
| Navigation | Custom tab system in `src/app/index.tsx` (NOT expo-router tabs) |
| Auth + DB | Supabase (`@supabase/supabase-js` v2), project in ap-northeast-2 Seoul |
| Storage | AsyncStorage for session persistence |
| Deep links | `expo-linking` + Supabase PKCE flow, scheme `liveopinionfeed` |
| Design system | `src/utils/peoliaScale.js` (fs/ms/vs/s) + `src/constants/peoliaTheme.js` |

---

## Build Config — DO NOT DELETE THESE FILES

Both files were created 2026-06-12 to fix "stuck at 99% bundling" + blank white screen:

- **`metro.config.js`** — `getDefaultConfig(__dirname)` from `expo/metro-config`. Without it,
  Metro never learns the router root is `src/app` (falls back to non-existent `app/`), Expo Router
  finds zero routes, and the app renders a blank white screen with no error. It ALSO carries a
  `resolver.resolveRequest` shim that redirects `react-async-hook` → its valid CJS entry
  (`dist/index.js`): that package (v3.6.1, pulled in by `react-native-country-picker-modal`) ships
  a broken `"module"` field pointing at a non-existent root `react-async-hook.esm.js`, which makes
  Metro fail to resolve it. Keep both the `getDefaultConfig` line and the shim.
- **`babel.config.js`** — `babel-preset-expo` with `'react-compiler': false`. Do NOT add
  `react-native-reanimated/plugin` or `react-native-worklets/plugin` manually — babel-preset-expo
  v56 auto-detects and adds the worklets plugin; adding it again runs the transform twice and
  hangs Metro at 99%.
- `app.json` has `"reactCompiler": false` — React Compiler hangs Metro on this codebase's
  `useRef(callback).current` patterns. Keep it off.

**Tunnel mode required** on this network (LAN blocked): `npx expo start --tunnel --clear`.
`@expo/ngrok` is installed as a devDependency to keep the tunnel stable.

---

## File Structure (post-cleanup — all Expo starter files deleted)

```
src/
  app/
    _layout.tsx          — SafeAreaProvider + ErrorBoundary + deep-link handler
    index.tsx            — Root: tab state, auth state, navigation orchestration
  screens/
    SentariumScreen.jsx  — Main 9:16 paged feed (sentarium_feed view, cursor pagination)
    TrendingScreen.jsx   — Top 20 by velocity_2h, wave filter pills
    FloatScreen.jsx      — Create senti (preview sub-screen, media stubs for Sprint 2/3)
    PinScreen.jsx        — Pinned sentis, direct-tap unpin (optimistic)
    ProfileScreen.jsx    — Own + other citizen, DNA radar chart, follow, edit profile
    AuthScreen.jsx       — Login / signup / forgot / reset-password
  components/
    SentiCard.jsx        — Card: WavePill + VoteBar + ActionBar + ViewReactsSheet
    ActionBar.jsx        — Like / voice / pin / ask column
    VoteBar.jsx          — Yes/Hmm/Nah; results after vote or view-lock
    ViewReactsSheet.jsx  — MODAL (blocks all background taps) — confirm before viewing reacts
    VoiceSheet.jsx       — Modal bottom sheet for voices (comments)
    EditProfileSheet.jsx — Modal: edit username / display_name / bio
    WaveImageSheet.jsx   — Modal: FloatScreen image picker (presets grid + Photos)
    ReportSheet.jsx      — Modal: reason picker for flagging/reporting a senti
    TabBar.jsx, WavePill.jsx, ErrorBoundary.jsx
  constants/peoliaTheme.js   — colors (getPeoliaColors), typography, spacing — DO NOT BREAK
  utils/peoliaScale.js       — fs/ms/vs/s scaling — DO NOT BREAK
  lib/supabase.js            — client (env vars) + subscribeToTable helper — DO NOT MODIFY CONFIG
supabase/
  migration.sql          — STALE (old opinions/votes schema). Real schema lives in dashboard only.
  seed-sentis.sql        — seed data for sentis
  sprint2-feed-avatar-and-images.sql — view v2 + senti-images bucket (see SQL PENDING below)
```

Deleted 2026-06-12 (do not resurrect): `App.js`, `FeedScreen`, `CreateScreen`, `SavedScreen`,
`ScreenWrapper`, `UserProfileScreen`, `src/app/explore.tsx`, all `themed-*`/`app-tabs`/
`animated-icon`/starter components, `src/hooks/`, `src/constants/theme.ts`, starter assets.
Removed deps: `@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-web-browser`.

---

## Database (Supabase, public schema)

**Tables:** sentis, senti_reactions, senti_counts (trigger-maintained — never write),
senti_likes, senti_pins, senti_view_locks, voices, voice_likes (voice_id, user_id),
follows (follower_id, following_id),
users (id, username, display_name, bio, avatar_url, dna_public, deleted_at),
user_private (user_id, phone, birthday, gender, recovery_email, *_public flags — own-row RLS),
user_stats, user_wave_stats,
senti_reports (id, senti_id, reporter_id, reason, status, created_at — one per user per senti),
notifications (id, user_id, actor_id, senti_id, type 'react'|'voice'|'reply'|'follow', is_read, created_at),
notification_prefs (user_id PK, notify_react/voice/reply/follow booleans default true — own-row RLS).

**Views:** `sentarium_feed` (feed queries), `trending_sentis` (velocity_2h desc).

**SQL already applied in dashboard (2026-06-12):**
1. `SECURITY DEFINER SET search_path = public` on all trigger functions of senti_likes /
   senti_pins / senti_reactions / voices — fixed RLS 42501 on senti_counts writes.
2. `ALTER TABLE sentis ALTER COLUMN status SET DEFAULT 'approved'` — client no longer sends
   status (moderation can be enabled later by flipping this default to 'pending').
3. `users.display_name` + `users.bio` columns added + `users_update_own` RLS policy
   (UPDATE USING/WITH CHECK auth.uid() = id).

**SQL applied + verified (2026-06-12, `supabase/sprint2-feed-avatar-and-images.sql`):**
1. `sentarium_feed` v2 — old view returned stale `'??'` initials and had NO `user_id`,
   so the creator avatar showed nothing useful and could never navigate. v2 computes
   initials from username and appends `user_id` + `avatar_url`. Confirmed: feed now
   returns `avatar_initials: "K"`, `user_id`, `avatar_url`.
2. `senti-images` storage bucket — public read, 5 MB cap, jpeg/png/webp; authenticated
   upload restricted to own `{user_id}/` folder. Confirmed: a real image float uploaded
   and is publicly readable. The `presets/` subfolder (for the preset picker) is listable
   by anon and managed via the dashboard.

**⚠️ SQL PENDING — run `supabase/sprint3-reports-and-avatars.sql` in the dashboard
before testing the Flag/report feature:**
- Creates `senti_reports` (id, senti_id→sentis, reporter_id→users, reason CHECK 7 values,
  status default 'pending', UNIQUE(senti_id, reporter_id)) + RLS: authenticated insert/select
  own only; no update/delete from client. Until applied, tapping Flag → "Could not report".
- Profile-picture upload needs NO SQL — avatars go to `senti-images/{uid}/avatar-*.jpg`
  (existing own-folder upload policy + public read already cover it) → `users.avatar_url`.

**Rules:** votes immutable (`ignoreDuplicates: true` upsert); one like/pin per user per senti
(toggle insert/delete); always filter sentis by `status = 'approved'`; cursor pagination only.
`users.avatar_initials` is a STALE stored column ('??') — never read it; derive the letter
from `username` client-side.

---

## Navigation

All in `src/app/index.tsx` via `activeTab` state. Tab keys:
`trending | float | sentarium | pin | profile` + hidden `auth | reset-password`.

- Guest mode: sentarium + trending browsable; float/pin/profile and all interactions
  route to auth via `onRequireAuth()`. Exception: tapping a creator avatar opens their
  profile for guests too (Follow inside is a session-gated no-op).
- **Always use `goToTab(tab)`, never `setActiveTab` directly** (keeps `activeTabRef` in
  sync for the `onAuthStateChange` closure).
- Cross-screen: `onNavigateToUser(userId)` → ProfileScreen overlay;
  `handleNavigateToFeedOpinion(id)` → sets `feedScrollToId` + jumps to sentarium
  (SentariumScreen moves target to index 0).

---

## Key Patterns in SentariumScreen

- **Optimistic + rollback** on every action; per-senti in-flight guards
  (`perSentiLikeInFlight` / `perSentiPinInFlight` refs) block double-taps.
- **`rawCounts` { yes, hmm, nah }** on each feed item — REQUIRED for optimistic vote math.
  `results` only holds pct + formatted strings. Kept in sync in: `normalise()`, the realtime
  handler, and the vote-rollback refetch. If you touch vote logic, preserve all three.
- **Refs mirror state** (`likedSentisRef`, `pinnedSentisRef`, `sessionRef`, `sentisRef`)
  to avoid stale closures.
- Realtime: ONE channel for the visible card only (`subscribeToVisible`), removed on change.
- `batchFetchStates(ids)` — one query per page for votes/locks/likes/pins (not per-card).
- Feed dedupes by id on `fetchMore`; `keyExtractor` is plain `item.id`.
- Bottom sheets are all `Modal` components with `paddingBottom: vs(20) + insets.bottom`
  (Android nav-bar clearance via `useSafeAreaInsets`).

---

## Changelog — 2026-06-12 session

| Change | Where |
|---|---|
| Fixed blank screen / 99% bundling (missing metro.config.js, babel double-plugin, React Compiler) | metro.config.js, babel.config.js, app.json |
| Fixed optimistic vote showing 100%/0%/0% (missing raw counts) | SentariumScreen `rawCounts` |
| Feed dedupe + stable keys | SentariumScreen |
| Follow/unfollow persisted to `follows` with rollback + live follower count | ProfileScreen |
| Direct-tap unpin (removed confirm dialog) | PinScreen |
| Ask → `Share.share()` with senti question | SentariumScreen → ActionBar |
| ErrorBoundary (no more blank screen on render crash) | src/components/ErrorBoundary.jsx + _layout.tsx |
| Feed network-error state with Retry (no longer fakes "empty") | SentariumScreen |
| ViewReactsSheet → true Modal: blocks card/votebar/tabbar taps until user chooses | ViewReactsSheet.jsx |
| All sheets respect Android nav-bar bottom inset | ViewReactsSheet, VoiceSheet, EditProfileSheet |
| Edit Profile: username/display_name/bio with validation + taken-username handling | EditProfileSheet.jsx + ProfileScreen |
| status no longer sent client-side (DB default) | FloatScreen |
| Empty-username crash guards (`|| '?'` not `?? '?'`) | ProfileScreen, VoiceSheet |
| Dead starter/legacy code deleted (~29 modules, 4 deps) | repo-wide |
| `.env` added to .gitignore | .gitignore |

**Note:** committed to `main` as `5085294`.

## Changelog — 2026-06-12 second session (Sprint 2)

| Change | Where |
|---|---|
| Feed creator avatar fixed: letter derived from `username` (view's stored initials were stale '??') | SentariumScreen `normalise()` |
| Avatar tap → creator's profile (view v2 adds `user_id`); guests allowed, no auth gate | SentariumScreen, index.tsx overlay |
| Avatar restyled to ProfileScreen pattern: solid accent circle + white letter; renders `avatar_url` photo when set | SentiCard |
| Full-bleed senti image: absolute-fill expo-image + 0.48 black overlay, white text, transparent WavePill, light ActionBar | SentiCard, ActionBar `onImage` |
| Image picker: 9:16 crop → upload to `senti-images/{uid}/` → `image_url` on insert; thumbnail + remove in media row; real image in preview | FloatScreen |
| ProfileScreen renders `avatar_url` photo (letter = fallback) | ProfileScreen |
| `expo-image-picker` installed + config plugin | package.json, app.json |
| sentarium_feed v2 + senti-images bucket SQL | supabase/sprint2-feed-avatar-and-images.sql (**applied + verified** — feed returns user_id/avatar_url, initials = first letter, image upload confirmed) |
| **Fix: image cards showed only the wave** — content now wrapped in a `zIndex:1` layer above the absolute image/overlay (Android ignores paint order; same reason FloatScreen preview uses zIndex:1) | SentiCard `content` |
| Preset image picker: WaveImageSheet lists `senti-images/presets/` at runtime; tap a preset → URL used directly (no upload); Photos option still launches gallery | WaveImageSheet.jsx + FloatScreen |

**Presets — how to add images:** Supabase dashboard → Storage → `senti-images` → create/open
`presets/` folder → upload jpg/png/webp. They appear in the Float image sheet automatically
(anon list confirmed working; public-read policy covers it). No SQL, no rebuild.

## Changelog — 2026-06-13 (profile pic + report)

| Change | Where |
|---|---|
| Profile picture: square-crop picker in Edit Profile → upload to `senti-images/{uid}/avatar-*` → `users.avatar_url`; circle preview + "Change photo" | EditProfileSheet.jsx, ProfileScreen onSaved |
| Flag/report a senti: 🚩 "Flag" added below Ask in the action column | ActionBar.jsx, SentiCard `onFlag` |
| ReportSheet: 7-reason picker → insert into `senti_reports` → senti removed from feed + "Thanks" (23505 dup treated as success) | ReportSheet.jsx, SentariumScreen `handleFlag`/`submitReport` |
| `senti_reports` table + RLS SQL (**PENDING — run in dashboard**) | supabase/sprint3-reports-and-avatars.sql |
| **Fix: NO remote images rendered (senti bg, presets, avatars)** — expo-image loads nothing in this Expo Go SDK 56 build; switched all `<Image>` to react-native (`resizeMode` not `contentFit`). Do not reintroduce expo-image without a dev build. | SentiCard, ProfileScreen, EditProfileSheet, FloatScreen, WaveImageSheet |
| **Fix: app-uploaded images were corrupt 14-byte files** — `fetch(localUri).arrayBuffer()` doesn't work in RN; switched to picker `base64:true` + `decode()` (base64-arraybuffer). Old avatars/senti images uploaded before this are broken — re-upload to fix. | FloatScreen `uploadImage`, EditProfileSheet `uploadAvatar` |
| Tap profile picture → full-screen viewer (own + other profiles) | ProfileScreen `viewerOpen` Modal |
| Avatars switched to fill pattern (image fills fixed-size clipped parent, matches preset tiles) | SentiCard, ProfileScreen, EditProfileSheet |
| User-profile overlay no longer runs under the system nav / loses the tab bar — TabBar now stays visible on the overlay (its bottom inset reserves the nav space) | index.tsx |
| FloatScreen text + icons 50% larger via aliased `fs` (`fs = fsBase(n*1.5)`) | FloatScreen |
| New `SentiTile` — 9:16 grid tile showing senti image_url (full-bleed) or wave colour + question | SentiTile.jsx |
| Profile "Floated sentis" and Pin grids → 2-per-row 9:16 SentiTiles (both fetch image_url; Pin tile has 📌 unpin) | ProfileScreen, PinScreen |
| Vote interaction redesign: VoteBar shows only emoji (chosen→Chosen colour, locks after vote, no %); new VoteResultsPanel (animated % towers) toggled by an eye icon in ActionBar; WavePill moved into topRow; swell badge moved under description | VoteBar, VoteResultsPanel.jsx (new), ActionBar, SentiCard |
| Light expo-haptics tap on Yes/Hmm/Nah vote | VoteBar |
| Branded empty states (EmptyState.jsx) + static skeleton loaders (Skeletons.jsx: FeedSkeleton/TrendingSkeleton/GridSkeleton, C.surfaceAlt shapes) replacing spinners/plain text | EmptyState.jsx, Skeletons.jsx (new); Sentarium, Trending, Pin, Profile |
| Float page polish: senti box ~3 lines / desc ~4 lines; wave pills −15%; media btns −10%; "Wave image"→"Image"; added GIF picker → media row is Image \| GIF \| Track (GIF = no-crop gallery pick, uploads image/gif) | FloatScreen |
| ActionBar shifted to top (`justifyContent:flex-start`) + compacted (`gap vs(18)→vs(10)`) — stable when results towers appear | ActionBar |
| GIF uploads: bucket allowed_mime_types += image/gif (**run allow-gif-uploads.sql**). RN Image animates GIFs in Expo Go. | supabase/allow-gif-uploads.sql |
| Pin + Profile grids → 3-per-row | PinScreen, ProfileScreen |
| Profile stats are now tabs: Sentis / Reacts (20 recent reacted sentis, desc) / Followers / Following. Followers/Following render PersonTile avatar grids (3-col, tap → that profile via onOpenUser) | ProfileScreen, PersonTile.jsx (new), index.tsx |
| Fix Follow button: follows RLS (insert/delete/select) + SECURITY DEFINER on follows triggers (**run sprint5 SQL**) | supabase/sprint5-follows-and-private-profile.sql |
| Edit profile: username + email read-only; new phone/birthday/gender (stored in private user_private table, own-row RLS); in-app change-password (auth.updateUser); sheet now scrollable | EditProfileSheet, user_private table |
| Followers/Following counts now derived live from follows (count head queries) — user_stats follower counts have no maintaining trigger, so don't read them | ProfileScreen fetchProfile |
| Feed index for sentarium_feed ordering (run feed-index.sql). Feed slowness is mostly Supabase free-tier latency + SentariumScreen re-mounting/refetching on every tab return | supabase/feed-index.sql |
| Feed keep-alive: SentariumScreen is now a persistent layer in index.tsx (always mounted, display:none when inactive) → returning to the tab is instant, no refetch. scrollToId effect now fetches off-page targets itself (was relying on remount→fetchSentis) | index.tsx, SentariumScreen |
| Profile own-view: modern Edit (filled accent) + Log out (outlined red, signOut with confirm) buttons; removed dead ⚙️ | ProfileScreen |
| Edit sheet polish (section headers Public/Private/Security + helpers); phone must be E.164 (+country code); password change now requires the current password (verified via signInWithPassword before any writes) | EditProfileSheet |

## Changelog — 2026-06-20 (theming, settings, app-lock, notifications)

| Change | Where |
|---|---|
| **ThemeContext** — `usePeoliaScheme()` / `useThemePref()`; manual Light/Dark/System, persisted (`peolia_theme_pref`). Codemod migrated all 32 files off raw `useColorScheme`. | src/context/ThemeContext.jsx + repo-wide |
| **SettingsScreen** (reached from Profile ⋮) — tabs General / Profile / Security. General: appearance (theme), haptics (`peolia_haptics`), notification prefs. Profile: hosts EditProfileSheet `bare` mode + Citizen DNA visibility (`users.dna_public`). Security: change pw/email-phone (jump to Profile tab), biometric app lock, log out everywhere, danger zone → delete account. | src/screens/SettingsScreen.jsx |
| **Biometric app lock** — `AppLockGate` in `_layout.tsx`; AppState-driven lock on launch/resume when `peolia_app_lock` true. | src/components/AppLockGate.jsx |
| **Delete account** — confirm sheet (type DELETE + password → re-auth → edge fn → signOut). Edge fn sets `users.deleted_at` + bans 720h. | SettingsScreen, supabase/functions/delete-account |
| **Notifications system** — NotificationContext (one realtime sub, single unread-count source, toast queue, nav-handler slot); NotificationToast (top slide-in, 4s, tap→navigate); notificationText util (shared list/toast text). List rows tappable; Hub + Profile badges read the context count (removed their duplicate subs). | NotificationContext, NotificationToast, notificationText, NotificationListScreen, NotificationsHubScreen, ProfileScreen |
| **focusSenti** deep-link in feed — token-driven prop; notification tap (or cross-screen) scrolls to the senti and opens VoiceSheet for voice/reply. Coexists with the existing `scrollToId` path (Trending/Profile). | SentariumScreen, index.tsx |
| **VoiceSheet** — optimistic post (no reload), avatar photos, removed the no-op pin icon; keyboard: `KeyboardAvoidingView behavior="padding"` + no statusBarTranslucent (composer stays above keyboard). | VoiceSheet.jsx |
| `handleVoicePosted` — targeted senti_counts refetch (accurate, no feed flicker, keeps rawCounts in sync). | SentariumScreen |
| Optional native modules (`expo-local-authentication`, `expo-haptics`) loaded via guarded `require` so the app boots even on a client without them compiled in. | AppLockGate, SettingsScreen |

**⚠️ SQL PENDING — run `supabase/settings-notifications-and-delete.sql`** (creates
`notification_prefs` + RLS, adds `users.deleted_at`) and **deploy** `delete-account`
(`npx supabase functions deploy delete-account --project-ref cobmoxjxwapinxcnmwhf`).
`users.dna_public` already exists. The `notifications` table + insert triggers must exist for
toasts/badges; Realtime must be enabled on `public.notifications` for live toasts.
App lock + haptics need a dev build that includes those native modules (degrade gracefully otherwise).

## Changelog — 2026-06-20 (block user)

| Change | Where |
|---|---|
| **BlockContext** — single source of truth for "users I can't see". `hiddenIds` (UNION of users I blocked + users who blocked me, from `get_blocked_ids()` RPC) drives content filtering; `iBlocked` drives the profile toggle. `block()`/`unblock()` call `block_user`/`unblock_user` RPCs (which also tear down follow edges). Added `BlockProvider` to the provider stack. | src/context/BlockContext.jsx, _layout.tsx |
| **Feed filter** — `sentarium_feed` query gets `.not('user_id','in',(…))` for blocked ids; a `hiddenIds` effect also drops already-loaded blocked cards (covers blocking from a profile overlay then returning). | SentariumScreen |
| **Trending filter** — `trending_sentis` has no creator column, so blocked rows are removed post-fetch by looking up creators of the returned ids. | TrendingScreen |
| **Voices filter** — VoiceSheet's `voices` query gets `.not('user_id','in',(…))`; replies left orphaned under a removed (blocked) parent just don't render. | VoiceSheet |
| **Profile block UI** — other-citizen profiles get a ⋮ menu (Block/Unblock); blocked profiles show a "You blocked this citizen" notice (stats/DNA/tabs hidden) with Unblock; avatar-row shows Unblock instead of Follow/Ask. Block confirm via Alert. | ProfileScreen |
| `ti-ban` → Feather `slash` added to the Icon map. | Icon.jsx |

**⚠️ SQL PENDING — run `supabase/sprint7-block-user.sql`** in the dashboard before
testing block: creates `user_blocks` (blocker_id, blocked_id, created_at) + RLS
(insert/delete/select own) and the `block_user` / `unblock_user` / `get_blocked_ids`
SECURITY DEFINER RPCs. Until applied, block/unblock and the feed/trending filters no-op
(RPCs return empty / error). This + the existing Flag/report feature completes Google Play
UGC compliance. Filtering now covers feed, trending, profile **and voices**.
**Not yet done:** moderation path on `senti_reports`.

---

## Known Issues

| Priority | Issue | Notes |
|---|---|---|
| 🟡 | "View reacts" lock is cosmetic | `sentarium_feed` returns counts to all clients; lock only hides them in UI. Server-side enforcement needed if the rule must be hard. |
| 🟡 | Vote can silently no-op | If `batchFetchStates` fails, user may "vote" on an already-voted senti — `ignoreDuplicates` returns no error; UI shows new choice, DB keeps old. Consider `.select()` on upsert + reconcile. |
| 🟡 | Pin state not synced across screens | Unpin in PinScreen doesn't update SentariumScreen state until refetch. |
| 🟡 | `handleViewLocked` has no rollback | Minor violation of optimistic+rollback rule. |
| 🟢 | Voices double-count briefly | Optimistic +1 plus realtime update can flash +2; no suppress flag for voices. |
| 🟢 | SentiCard not memoized | Every realtime tick re-renders all mounted cards. Add React.memo + useCallback renderItem + getItemLayout. |
| 🟢 | Realtime channel churn on fast scroll | Debounce `subscribeToVisible` ~300ms. |
| 🟢 | 956KB MaterialSymbols font bundles | expo-router's own internal dependency (expo-symbols) — not removable from app side. |
| 🟢 | Schema not in repo | `migration.sql` is the OLD schema. Export real DDL to `supabase/schema.sql` (`supabase db dump`). |
| 🟢 | Zero tests | Start with pure helpers (buildResults, normalise, formatCount). |

---

## Future Development (priority order)

1. ~~**Sprint 2 — image picker**~~ DONE 2026-06-12. ~~**Avatar upload**~~ DONE 2026-06-13
   (EditProfileSheet square picker → `users.avatar_url`).
2. **Voices polish** — realtime subscription while sheet open, pagination past 50,
   delete-own-voice.
3. ~~**Report**~~ DONE 2026-06-13 (Flag → senti_reports, hides senti). Remaining for full
   Play UGC compliance: **block user** (user_blocks table + filter blocked users' sentis
   from feed/trending/profile) and a dashboard/moderation path on senti_reports.
4. **OnboardingScreen** — splash, walkthrough, wave picker.
5. **NotificationsScreen** — nudges, voices, reacts (expo-notifications + Edge Function).
6. **Search** — Postgres full-text on sentis.question.
7. **Sprint 3 — Track feature** (FloatScreen stub exists).
8. **Production**: EAS Build for Play Store (Expo Go can't ship), SMTP for auth emails
   (SendGrid/Resend), moderation pipeline (flip status default to 'pending' + approval path).
9. **Perf pass**: React.memo SentiCard, getItemLayout, channel debounce.

---

## Environment / How to Run

```
# .env (gitignored, never commit)
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

```bash
npx expo start --tunnel          # normal (LAN blocked on this network)
npx expo start --tunnel --clear  # after config/native changes
npx expo export --platform android  # quick "does it bundle" check without a device
```
