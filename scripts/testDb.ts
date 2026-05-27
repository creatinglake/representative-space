import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const tables = [
    "representative_spaces", "verification_records", "civic_events",
    "outcome_deliveries", "positions", "responses",
    "citizen_issues", "issue_signals", "issue_responses", "processes",
  ];

  let allOk = true;
  for (const t of tables) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log("❌", t, "-", error.message);
      allOk = false;
    } else {
      console.log("✅", t, `(${count} rows)`);
    }
  }

  if (allOk) {
    console.log("\n🎉 All 10 tables accessible. Database is ready.");
  } else {
    console.log("\n⚠️  Some tables had errors.");
    process.exit(1);
  }
}

main();
