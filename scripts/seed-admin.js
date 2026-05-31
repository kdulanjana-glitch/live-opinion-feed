/**
 * Live Opinion Feed — Admin Seed Script
 *
 * BEFORE RUNNING:
 *   1. Run supabase/migration.sql in your Supabase SQL Editor (adds description column)
 *   2. Add SUPABASE_SERVICE_ROLE_KEY to your .env file
 *      (Dashboard → Settings → API → service_role secret)
 *   3. node scripts/seed-admin.js
 */

const fs   = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env");
try {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq < 1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    });
} catch (_) {}

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars.\n" +
    "  EXPO_PUBLIC_SUPABASE_URL   — already in .env\n" +
    "  SUPABASE_SERVICE_ROLE_KEY  — add to .env (Dashboard → Settings → API → service_role)\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Opinion seed data ─────────────────────────────────────────────────────────
// agree / disagree set to realistic numbers to populate the trending list
const SEED_OPINIONS = [
  // POLITICS
  {
    text: "Politicians should have strict term limits",
    description: "Career politicians lose touch with everyday citizens. Fresh perspectives prevent power from becoming permanently entrenched.",
    category: "politics", agree: 1243, disagree: 412,
  },
  {
    text: "Voting should be mandatory for all citizens",
    description: "Countries with compulsory voting consistently elect more representative governments and produce less political extremism.",
    category: "politics", agree: 634, disagree: 891,
  },
  {
    text: "Democracy works better than any other system",
    description: "Despite its inefficiencies, democratic governance has proven more stable and protective of individual rights than alternatives.",
    category: "politics", agree: 987, disagree: 342,
  },

  // FOOD
  {
    text: "Veganism is the most ethical lifestyle choice",
    description: "Plant-based diets dramatically reduce individual carbon footprints, water usage, and animal suffering with minimal sacrifice.",
    category: "food", agree: 456, disagree: 723,
  },
  {
    text: "Fast food should be taxed like cigarettes",
    description: "Processed food causes comparable long-term health damage to tobacco. Public health costs justify the same deterrent tax.",
    category: "food", agree: 512, disagree: 488,
  },
  {
    text: "Cooking at home is always better than eating out",
    description: "Home cooking gives full control over ingredients and nutrition, and is far more cost-effective for families long-term.",
    category: "food", agree: 334, disagree: 621,
  },

  // HEALTH
  {
    text: "Mental health days should be mandatory at work",
    description: "Burnout costs companies far more than rest days ever would. Psychological wellbeing is foundational to sustainable performance.",
    category: "health", agree: 1456, disagree: 287,
  },
  {
    text: "Smartphones are the biggest modern health threat",
    description: "Screen addiction is linked to anxiety, depression, sleep disorders, and declining attention spans across every age group.",
    category: "health", agree: 765, disagree: 543,
  },
  {
    text: "Exercise matters more than diet for a long life",
    description: "Research shows active people with imperfect diets often outlive sedentary individuals who eat perfectly clean.",
    category: "health", agree: 423, disagree: 677,
  },

  // SPORTS
  {
    text: "Professional athletes are dangerously overpaid",
    description: "When athletes earn more in one match than nurses earn in a decade, society's values need serious re-examination.",
    category: "sports", agree: 1087, disagree: 654,
  },
  {
    text: "E-sports should compete in the Olympic Games",
    description: "Competitive gaming demands extraordinary reflexes, strategy, and mental discipline — no less than archery or shooting.",
    category: "sports", agree: 445, disagree: 832,
  },

  // ENVIRONMENT
  {
    text: "Individual actions cannot stop climate change",
    description: "Corporate emissions dwarf consumer choices. Systemic policy change — not personal recycling — is the only solution that scales.",
    category: "environment", agree: 876, disagree: 1124,
  },
  {
    text: "Petrol cars should be banned in cities by 2030",
    description: "Air pollution kills 7 million people yearly. EV mandates in urban centres would be the single biggest health intervention possible.",
    category: "environment", agree: 654, disagree: 891,
  },

  // EDUCATION
  {
    text: "University degrees are no longer worth the debt",
    description: "With skills-based hiring rising and online learning maturing, traditional four-year degrees offer rapidly diminishing returns.",
    category: "education", agree: 934, disagree: 456,
  },
  {
    text: "Kids should learn financial literacy before algebra",
    description: "Most adults never use quadratic equations but manage money every day. School curricula have their priorities completely backwards.",
    category: "education", agree: 1234, disagree: 321,
  },

  // ENTERTAINMENT
  {
    text: "Streaming platforms have destroyed cinema culture",
    description: "Theatrical releases now serve as premium previews for home viewing. The communal magic of cinema is fading irreversibly.",
    category: "entertainment", agree: 543, disagree: 765,
  },
  {
    text: "Video games are a fully legitimate art form",
    description: "Modern games combine music, writing, visual design, and interactive storytelling in ways no previous medium could achieve.",
    category: "entertainment", agree: 876, disagree: 432,
  },

  // SCIENCE
  {
    text: "AI will surpass human intelligence within 15 years",
    description: "The exponential pace of machine learning improvements suggests artificial general intelligence is closer than most scientists admit.",
    category: "science", agree: 567, disagree: 743,
  },
  {
    text: "Space exploration money should fix Earth first",
    description: "While missions reach Mars, billions lack clean water. Redirecting even 10% of space budgets could end preventable suffering.",
    category: "science", agree: 756, disagree: 944,
  },

  // TECH
  {
    text: "Social media companies must be liable for user harm",
    description: "Platforms profiting from radicalisation algorithms should face the same liability as publishers who print harmful content.",
    category: "tech", agree: 876, disagree: 423,
  },
  {
    text: "Working from home makes people less productive",
    description: "Offices drive collaboration, accountability, and spontaneous ideas that remote work setups fundamentally cannot replicate.",
    category: "tech", agree: 432, disagree: 876,
  },

  // SOCIETY
  {
    text: "The four-day work week should be universal law",
    description: "Multi-country trials show 4-day weeks increase productivity, reduce sick days, and dramatically improve worker wellbeing.",
    category: "society", agree: 1543, disagree: 287,
  },

  // LOVE
  {
    text: "Long-distance relationships are destined to fail",
    description: "Physical proximity is fundamental to human bonding. Technology creates an illusion of closeness but cannot replace true presence.",
    category: "love", agree: 456, disagree: 789,
  },

  // LIFE
  {
    text: "Failure teaches more than success ever could",
    description: "Every great achievement in history was built on repeated failure. Real resilience, creativity, and wisdom come through our losses.",
    category: "life", agree: 1234, disagree: 234,
  },

  // MONEY
  {
    text: "Universal basic income would end the poverty trap",
    description: "Guaranteed income floors let people retrain, take entrepreneurial risks, and break free from systemic cycles of deprivation.",
    category: "money", agree: 654, disagree: 876,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("─────────────────────────────────────────");
  console.log("  Live Opinion Feed — Admin Seed Script  ");
  console.log("─────────────────────────────────────────\n");

  // 1. Create or find admin user
  console.log("1. Creating admin user…");
  let adminId;

  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email: "admin@liveopinionfeed.com",
      password: "Admin@LiveFeed2025!",
      email_confirm: true,
      user_metadata: { username: "Admin" },
    });

  if (createError) {
    if (
      createError.message?.toLowerCase().includes("already") ||
      createError.message?.toLowerCase().includes("exists")
    ) {
      console.log("   Admin user already exists — fetching ID…");
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const existing = list?.users?.find(
        (u) => u.email === "admin@liveopinionfeed.com"
      );
      if (!existing) {
        console.error("   Could not find existing admin user. Aborting.");
        return;
      }
      adminId = existing.id;
    } else {
      console.error("   Auth error:", createError.message);
      return;
    }
  } else {
    adminId = createData.user.id;
    console.log("   ✓ Admin user created");
  }
  console.log(`   Admin ID: ${adminId}`);

  // 2. Upsert admin profile
  console.log("\n2. Upserting admin profile…");
  const { error: profileError } = await supabase
    .from("users")
    .upsert({ id: adminId, username: "Admin" }, { onConflict: "id" });
  if (profileError) {
    console.warn("   Profile warning (non-fatal):", profileError.message);
  } else {
    console.log("   ✓ Profile ready");
  }

  // 3. Check for existing opinions
  console.log("\n3. Checking for existing seed opinions…");
  const { data: existing } = await supabase
    .from("opinions")
    .select("id")
    .eq("created_by", adminId);

  if (existing && existing.length > 0) {
    console.log(
      `   Found ${existing.length} existing admin opinions — skipping insert.\n` +
      "   Delete them in Supabase if you want to re-seed."
    );
  } else {
    // 4. Insert opinions
    console.log(`   Inserting ${SEED_OPINIONS.length} opinions…`);
    const rows = SEED_OPINIONS.map((op) => ({
      text:         op.text,
      description:  op.description,
      category:     op.category,
      agree_count:  op.agree,
      disagree_count: op.disagree,
      total_votes:  op.agree + op.disagree,
      like_count:   Math.floor(Math.random() * 150) + 10,
      save_count:   Math.floor(Math.random() * 60),
      comment_count: Math.floor(Math.random() * 30),
      created_by:   adminId,
      status:       "approved",
    }));

    const { error: insertError } = await supabase.from("opinions").insert(rows);
    if (insertError) {
      console.error("   Insert error:", insertError.message);
      console.error(
        "   Did you run supabase/migration.sql in the Supabase SQL Editor first?"
      );
      return;
    }
    console.log(`   ✓ ${SEED_OPINIONS.length} opinions inserted`);
  }

  console.log("\n─────────────────────────────────────────");
  console.log("  ✅ Done!");
  console.log("  Login: admin@liveopinionfeed.com");
  console.log("  Password: Admin@LiveFeed2025!");
  console.log("─────────────────────────────────────────\n");
}

seed().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
