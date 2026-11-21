// Demo customers and gift cards for recording onboarding videos on the LOCAL database.
//   node scripts/onboarding-videos/demo-data.mjs seed    adds them (safe to run twice)
//   node scripts/onboarding-videos/demo-data.mjs clean   removes them and everything they own
// Everything is tagged: customers use the fictional range 0400 555 2xx, gift cards carry DEMO_NOTE.
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error(`Refusing to touch a non-local database: ${url}`);
const db = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

export const DEMO_NOTE = "Demo data for onboarding videos";
const PHONE_PREFIX = "+61400555"; // + 3 digits, 2xx

const CUSTOMERS = [
  { phone: "+61400555201", first_name: "Emily", last_name: "Tran" },
  { phone: "+61400555202", first_name: "Olivia", last_name: "Smith" },
  { phone: "+61400555203", first_name: "Linh", last_name: "Pham" },
  { phone: "+61400555204", first_name: "Chloe", last_name: "Wilson" },
  // No gift card yet: the videos create one for her (0400 555 205).
  { phone: "+61400555205", first_name: "Mia", last_name: "Nguyen" },
];

// amount, balance left, which customer (index or null), sold how many days ago
const CARDS = [
  { amount: 10000, left: 10000, who: 0, daysAgo: 2 },
  { amount: 5000, left: 2750, who: 1, daysAgo: 20 },
  { amount: 15000, left: 15000, who: null, daysAgo: 35 },
  { amount: 20000, left: 8500, who: 2, daysAgo: 60 },
  { amount: 5000, left: 5000, who: 3, daysAgo: 90 },
];

function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function newCode() {
  // Same shape as _new_gift_card_code: prefix + 7 digits + a Luhn digit over the digits.
  const digits = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const check = must(await db.rpc("_luhn_check_digit", { p_digits: digits }), "luhn");
  return `BN${digits}${check}`;
}

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 86400_000);
  return d.toLocaleDateString("en-CA", { timeZone: "Australia/Hobart" });
}

async function seed() {
  const existing = must(await db.from("gift_cards").select("id").eq("notes", DEMO_NOTE), "find demo cards");
  if (existing.length) return console.log(`Demo data already there (${existing.length} gift cards).`);

  const ids = [];
  for (const c of CUSTOMERS) {
    const row = must(await db.from("customers").upsert(c, { onConflict: "phone" }).select("id").single(), "customer");
    ids.push(row.id);
  }
  for (const card of CARDS) {
    const sold = isoDaysAgo(card.daysAgo);
    const expires = `${Number(sold.slice(0, 4)) + 3}${sold.slice(4)}`;
    const customerId = card.who === null ? null : ids[card.who];
    const { id } = must(
      await db
        .from("gift_cards")
        .insert({ code: await newCode(), amount_cents: card.amount, balance_cents: 0, customer_id: customerId, sold_on: sold, expires_on: expires, notes: DEMO_NOTE })
        .select("id")
        .single(),
      "gift card",
    );
    must(await db.rpc("_post_gift_card", { p_gift_card_id: id, p_kind: "sale", p_delta_cents: card.amount, p_customer_id: customerId }), "sale");
    if (card.left < card.amount) {
      must(await db.rpc("_post_gift_card", { p_gift_card_id: id, p_kind: "spend", p_delta_cents: card.left - card.amount, p_customer_id: customerId }), "spend");
    }
  }
  console.log(`Seeded ${CUSTOMERS.length} customers and ${CARDS.length} gift cards.`);
}

async function clean() {
  const customers = must(await db.from("customers").select("id").like("phone", `${PHONE_PREFIX}2%`), "find customers");
  const ids = customers.map((c) => c.id);
  const byNote = must(await db.from("gift_cards").select("id").eq("notes", DEMO_NOTE), "find cards");
  const byOwner = ids.length ? must(await db.from("gift_cards").select("id").in("customer_id", ids), "find owned cards") : [];
  const cardIds = [...new Set([...byNote, ...byOwner].map((c) => c.id))];
  if (cardIds.length) {
    must(await db.from("gift_card_transactions").delete().in("gift_card_id", cardIds), "delete card history");
    must(await db.from("gift_cards").delete().in("id", cardIds), "delete cards");
  }
  if (ids.length) must(await db.from("customers").delete().in("id", ids), "delete customers");
  console.log(`Removed ${cardIds.length} gift cards and ${ids.length} customers.`);
}

const cmd = process.argv[2];
if (cmd === "seed") await seed();
else if (cmd === "clean") await clean();
else console.log("Usage: node scripts/onboarding-videos/demo-data.mjs seed|clean");
