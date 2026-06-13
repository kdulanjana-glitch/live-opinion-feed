---
description: 
alwaysApply: true
---

---
description: 
alwaysApply: true
---

PROJECT: Peolia — React Native / Expo app for Android
BACKEND: Supabase (PostgreSQL) — project in ap-northeast-2 Seoul

TECH STACK:
- React Native with Expo Go
- Supabase JS client for all DB calls
- Android only — no iOS, no hover states ever

DESIGN SYSTEM:
- All font sizes must use fs() from src/utils/peoliaScale.js
- All spacing must use ms(), vs(), s() from src/utils/peoliaScale.js
- All colors from src/constants/peoliaTheme.js via getPeoliaColors()
- Never hardcode font sizes, padding, or colors

DATABASE RULES:
- All tables in public schema
- UUID primary keys on all tables — sentis.id is source of truth
- Never update senti_counts manually — triggers handle it
- Always filter sentis by status = 'approved'
- Never send status on sentis insert — DB column default controls it
- Use sentarium_feed view for feed queries
- Use trending_sentis view for trending queries
- Votes cannot be changed once cast
- One like per user per senti — toggle delete/insert
- One pin per user per senti — toggle delete/insert
- Trigger functions on interaction tables are SECURITY DEFINER (applied 2026-06-12)
- users has display_name + bio + avatar_url columns; users_update_own RLS policy allows own-row updates
- users.avatar_initials is STALE ('??') — never read it; derive the letter from username
- senti images: senti-images storage bucket (public read, auth upload to own {user_id}/ folder only);
  upload BEFORE sentis insert, store the public URL in sentis.image_url

CODE RULES:
- No hover states — Android only
- Always use peoliaScale functions for sizing
- Always use getPeoliaColors() for colors
- Optimistic UI on all user actions — update local state first
- Rollback on DB failure
- Cursor pagination only — never load all records at once
- Real-time subscriptions only for visible content
- Unsubscribe when component unmounts

FILE OWNERSHIP:
- src/utils/peoliaScale.js — sizing system, do not break
- src/constants/peoliaTheme.js — color system, do not break
- src/lib/supabase.js — DB client, do not modify connection config
- metro.config.js — required for Expo Router to find src/app; deleting it = blank white screen
- babel.config.js — react-compiler must stay false; NEVER add reanimated/worklets plugin
  manually (babel-preset-expo auto-adds it; doubling it hangs Metro at 99%)

CODE PATTERNS (see HANDOFF.md for full details):
- Feed items carry rawCounts {yes,hmm,nah} — required for optimistic vote math;
  must stay in sync in normalise(), the realtime handler, and vote rollback
- Bottom sheets are Modal components with paddingBottom: vs(20) + insets.bottom
  (Android nav-bar clearance)
- In index.tsx always navigate via goToTab(), never setActiveTab directly

TABLES:
public.sentis, public.senti_reactions, public.senti_counts,
public.senti_likes, public.senti_pins, public.senti_view_locks,
public.voices, public.follows, public.user_stats,
public.user_wave_stats, public.users
