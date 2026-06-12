-- ============================================================
-- Peolia — Seed Sentis
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- WARNING: This deletes ALL existing sentis and related data.
-- Run only in dev/staging.
-- ============================================================

-- 1. Clean up child tables first (avoids FK constraint errors)
DELETE FROM senti_reactions   WHERE senti_id IN (SELECT id FROM sentis);
DELETE FROM senti_likes       WHERE senti_id IN (SELECT id FROM sentis);
DELETE FROM senti_pins        WHERE senti_id IN (SELECT id FROM sentis);
DELETE FROM senti_view_locks  WHERE senti_id IN (SELECT id FROM sentis);
DELETE FROM voices            WHERE senti_id IN (SELECT id FROM sentis);
DELETE FROM senti_counts      WHERE senti_id IN (SELECT id FROM sentis);

-- 2. Delete all sentis
DELETE FROM sentis;

-- 3. Insert 20 fresh seed sentis
--    user_id is left NULL (shows "?" avatar in feed).
--    To attach to a real user, replace NULL with their UUID:
--    SELECT id FROM auth.users WHERE email = 'admin@liveopinionfeed.com';

INSERT INTO public.sentis (user_id, question, description, wave, status)
VALUES

  (
    NULL,
    'Should AI companies be legally liable for harm caused by their models?',
    'As AI systems make autonomous decisions in healthcare, finance and law, the question of accountability is urgent. If a model causes real harm, who pays — the user, the developer, or the company?',
    'Tech', 'approved'
  ),

  (
    NULL,
    'Social media algorithms are doing more damage to society than any government ever could.',
    'Algorithms optimise for engagement, not truth. They amplify outrage, deepen political divides, and quietly rewire how millions think. No one voted for this system — yet it shapes everything.',
    'Tech', 'approved'
  ),

  (
    NULL,
    'Mental health should be treated with the same urgency as a physical emergency.',
    'A broken leg gets immediate care. A mental breakdown gets a 6-week waiting list. The stigma is fading but the system hasn''t caught up. Should hospitals treat mental crises as true emergencies?',
    'Health', 'approved'
  ),

  (
    NULL,
    'Owning a home is no longer a realistic life goal for most people under 35.',
    'Property prices have outpaced wages for two decades. In most major cities, a 20% deposit now takes 15+ years to save on an average salary. Is homeownership becoming a privilege, not a milestone?',
    'Money', 'approved'
  ),

  (
    NULL,
    'Cancel culture has gone too far — one mistake should not define a person''s entire life.',
    'Public shaming moves faster than facts. People lose careers, families, and mental health over a single post. When does accountability end and punishment without redemption begin?',
    'Society', 'approved'
  ),

  (
    NULL,
    'Voting should be made mandatory for all citizens in a democracy.',
    'Countries with compulsory voting like Australia see 90%+ turnout. Critics say forced voting undermines freedom. But does staying silent give fringe groups disproportionate power over everyone?',
    'Politics', 'approved'
  ),

  (
    NULL,
    'Long-distance relationships are just as valid and sustainable as any other relationship.',
    'Technology has made long-distance easier — video calls, voice notes, shared playlists. But can a relationship truly thrive without physical presence, shared routines, and spontaneous moments?',
    'Love', 'approved'
  ),

  (
    NULL,
    'University degrees are becoming financially reckless for most career paths.',
    'Graduates leave with massive debt and enter job markets that increasingly value skills over credentials. Coding bootcamps, apprenticeships, and self-learning often outperform a 3-year degree in ROI.',
    'Education', 'approved'
  ),

  (
    NULL,
    'Individual recycling habits are meaningless without systemic corporate change.',
    'Just 100 companies produce 71% of global emissions. While citizens are guilt-tripped for using plastic straws, fossil fuel lobbying continues unchecked. Is personal responsibility a distraction?',
    'Environment', 'approved'
  ),

  (
    NULL,
    'Choosing not to have children is one of the most responsible decisions a person can make.',
    'With climate anxiety, economic instability, and overpopulation concerns rising, more people are choosing to be childfree. Yet society still treats this as selfish or incomplete. Should it?',
    'Life', 'approved'
  ),

  (
    NULL,
    'Esports athletes deserve the same recognition and respect as traditional sports professionals.',
    'Top esports players train 12+ hours daily, compete globally, and earn millions. Yet mainstream culture still dismisses gaming as a hobby. At what point does skill and dedication earn equal respect?',
    'Sports', 'approved'
  ),

  (
    NULL,
    'Streaming platforms have killed the magic of cinema as a shared cultural experience.',
    'When everyone watches at home on different schedules, the cultural moment disappears. Nobody watches the same thing anymore. Has convenience quietly destroyed the idea of shared storytelling?',
    'Entertainment', 'approved'
  ),

  (
    NULL,
    'A four-day work week should be the global standard by 2030.',
    'Trials in Iceland, Japan, and the UK showed equal or higher productivity with a four-day week, alongside better mental health and lower burnout. Why are most companies still resistant to the evidence?',
    'Money', 'approved'
  ),

  (
    NULL,
    'Free speech should have limits when it incites hatred or endangers vulnerable groups.',
    'Absolute free speech sounds fair in theory. In practice, it gives a platform to those who dehumanise minorities, spread medical misinformation, and radicalise vulnerable people. Where is the line?',
    'Society', 'approved'
  ),

  (
    NULL,
    'The pharmaceutical industry prioritises profit over patient welfare — and it is killing people.',
    'Insulin that costs $3 to make sells for $300 in the US. Cures are less profitable than lifelong treatments. When shareholder returns drive medical research, who is really being served?',
    'Health', 'approved'
  ),

  (
    NULL,
    'Social media has made genuine human connection harder, not easier.',
    'We have more followers and fewer close friends. Loneliness is at epidemic levels despite being more connected than ever. Are we performing connection online while the real thing slowly disappears?',
    'Life', 'approved'
  ),

  (
    NULL,
    'Governments should have the right to shut down the internet during national emergencies.',
    'Some countries shut down the internet during elections or protests. Supporters cite stability. Critics call it state censorship. Can cutting access ever truly be justified in a democracy?',
    'Tech', 'approved'
  ),

  (
    NULL,
    'Politicians should be subject to a maximum age limit of 70 to hold public office.',
    'The average age of world leaders is rising while the populations they govern get younger. Decisions on climate, AI, and debt fall to people who won''t live with the consequences. Is that fair?',
    'Politics', 'approved'
  ),

  (
    NULL,
    'Human gene editing to eliminate hereditary disease should be fully legalised worldwide.',
    'CRISPR technology can eliminate conditions like cystic fibrosis before birth. Critics fear designer babies and genetic inequality. But if you could prevent a child from suffering, should you?',
    'Science', 'approved'
  ),

  (
    NULL,
    'Prison systems are failing — rehabilitation should replace punishment as the primary goal.',
    'Countries like Norway have 20% reoffending rates vs 60%+ in the US and UK. The evidence for rehabilitation-focused systems is overwhelming. Why do most societies still default to punitive justice?',
    'Society', 'approved'
  );

-- Confirm
SELECT COUNT(*) AS total_sentis FROM public.sentis;
