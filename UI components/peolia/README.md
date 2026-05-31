# Peolia UI Components — Setup Guide

## Files in this package

```
src/
├── constants/
│   └── peoliaTheme.js       ← Color system, typography, spacing, wave colors
├── components/
│   ├── TabBar.jsx            ← Floating pill tab bar
│   ├── WavePill.jsx          ← Wave category badge
│   ├── VoteBar.jsx           ← Yes / Hmm / Nah vote buttons (both states)
│   ├── ActionBar.jsx         ← Right-side like/voice/pin/ask bar
│   ├── ViewReactsSheet.jsx   ← Bottom sheet warning before viewing reacts
│   └── SentiCard.jsx         ← Full feed card (all states combined)
└── screens/
    ├── SentariumScreen.jsx   ← Main feed (replaces FeedScreen.jsx)
    ├── TrendingScreen.jsx    ← Trending list (replaces existing TrendingScreen.jsx)
    ├── FloatScreen.jsx       ← Create senti (replaces CreateScreen.jsx)
    └── ProfileScreen.jsx     ← Own + other citizen profile (replaces ProfileScreen.jsx)
```

---

## Step 1 — Copy files into your project

Copy the following into your project:
- `src/constants/peoliaTheme.js` → `src/constants/peoliaTheme.js`
- All files in `src/components/` → `src/components/`
- All files in `src/screens/` → replace your existing screens

---

## Step 2 — Install react-native-svg (for DNA chart)

The Citizen DNA radar chart in ProfileScreen uses `react-native-svg`.

```bash
npx expo install react-native-svg
```

---

## Step 3 — Wire up TabBar in index.tsx

Replace your existing tab navigation switch with:

```tsx
// src/app/index.tsx

import TabBar from '../components/TabBar';
import SentariumScreen from '../screens/SentariumScreen';
import TrendingScreen from '../screens/TrendingScreen';
import FloatScreen from '../screens/FloatScreen';
import ProfileScreen from '../screens/ProfileScreen';
// import PinScreen from '../screens/PinScreen'; // coming soon

const [activeTab, setActiveTab] = useState('sentarium');
const [openSentiId, setOpenSentiId] = useState(null);

const renderScreen = () => {
  switch (activeTab) {
    case 'sentarium':
      return <SentariumScreen />;
    case 'trending':
      return (
        <TrendingScreen
          onOpenSenti={(id) => {
            setOpenSentiId(id);
            setActiveTab('sentarium');
          }}
        />
      );
    case 'float':
      return (
        <FloatScreen
          onBack={() => setActiveTab('sentarium')}
          onFloated={() => setActiveTab('sentarium')}
        />
      );
    case 'pin':
      return <View />; // PinScreen coming soon
    case 'profile':
      return <ProfileScreen onOpenSenti={(id) => setActiveTab('sentarium')} />;
    default:
      return <SentariumScreen />;
  }
};

return (
  <SafeAreaView style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>
      {renderScreen()}
    </View>
    <TabBar activeTab={activeTab} onTabPress={setActiveTab} />
  </SafeAreaView>
);
```

---

## Step 4 — Supabase table names

These components expect the following table names.
Update to match your actual schema:

| Component expects | Your current table | Action |
|---|---|---|
| `sentis` | `opinions` | Rename or alias |
| `senti_reactions` | TBD | Create new |
| `senti_counts` | TBD | Create view/table |
| `senti_likes` | TBD | Create new |
| `senti_pins` | TBD | Create new |
| `users` | `users` | Check column names |
| `user_stats` | TBD | Create view/table |
| `user_wave_stats` | TBD | Create view/table |

---

## Step 5 — Color system migration

Your current primary color is `#7C3AED` (purple).
Peolia design system uses `#4F46E5` (indigo).

The new `peoliaTheme.js` replaces your inline `palette` objects.
Update each existing screen to import from `peoliaTheme.js`:

```js
// Replace this pattern in old screens:
const palette = { dark: { primary: '#7C3AED', ... }, ... };
const colors = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];

// With this:
import { getPeoliaColors } from '../constants/peoliaTheme';
const C = getPeoliaColors(useColorScheme());
```

---

## TODO — Screens not yet generated
- `PinScreen.jsx` — saved/bookmarked sentis
- `NotificationsScreen.jsx` — nudges, voices, reacts
- `OnboardingScreen.jsx` — splash, walkthrough, sign up, username, wave picker
- `GalleryScreen.jsx` — image picker for Float screen

These will be generated in the next session.

---

## Notes for Claude Code

1. **react-native-svg** is required for the DNA chart — install it first
2. **Table names** in Supabase need to be confirmed — see Step 4
3. **Image backgrounds** on the feed card will need `ImageBackground` 
   component once image_url is populated from Supabase storage
4. **Vote button icons** are currently emoji — to be replaced with 
   custom SVGs in Sprint 2 (Option A)
5. **Track feature** is stubbed with an Alert — implement in Sprint 3
