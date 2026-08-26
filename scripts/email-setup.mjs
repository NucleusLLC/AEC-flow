/**
 * Turn on server-side email, end to end, from one command.
 *
 * Sending from AEC-flow needs two things the code cannot supply itself: a Resend
 * API key, and a sending domain that Resend has verified. `aec-flow.com` has no
 * MX record and no SPF record — nothing on the internet is currently authorised
 * to send as it — so the "Send" button fails by design rather than by bug. This
 * script does every step of fixing that except the two that need a human:
 * creating the Resend account, and pasting the key.
 *
 *   node scripts/email-setup.mjs status          what is configured, what is not
 *   node scripts/email-setup.mjs add             register the domain, print its DNS records
 *   node scripts/email-setup.mjs dns             write those records into Cloudflare
 *   node scripts/email-setup.mjs verify          ask Resend to re-check them
 *   node scripts/email-setup.mjs test <address>  send one real email and report the id
 *
 * Environment (dotenv is loaded, so .env works):
 *   RESEND_API_KEY       required by everything but `status`
 *   EMAIL_DOMAIN         defaults to aec-flow.com
 *   CLOUDFLARE_API_TOKEN required only by `dns`, needs Zone:DNS:Edit on the zone
 *
 * THE KEY IS NEVER PRINTED, not even truncated, and not in an error path. A
 * secret that reaches a terminal reaches that terminal's scrollback, and this
 * script's whole job is to be run while someone is watching the screen.
 */
import "dotenv/config";

const DOMAIN = (process.env.EMAIL_DOMAIN || "aec-flow.com").trim();
const KEY = (process.env.RESEND_API_KEY || "").trim();
const CF = (process.env.CLOUDFLARE_API_TOKEN || "").trim();

const RESEND = "https://api.resend.com";
const CFAPI = "https://api.cloudflare.com/client/v4";

/** A key that is present but obviously not a key is worse than an absent one:
 *  it turns "not configured" into "provider says invalid", which reads as an
 *  outage. Real Resend keys start `re_`; the repo ships `placeholder`. */
function keyState() {
  if (!KEY) return "missing";
  if (!KEY.startsWith("re_")) return "placeholder";
  return "present";
}

async function resend(path, init = {}) {
  const res = await fetch(RESEND + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function cloudflare(path, init = {}) {
  const res = await fetch(CFAPI + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${CF}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function die(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

function requireKey() {
  const s = keyState();
  if (s === "missing") die("RESEND_API_KEY is not set. Create a key at resend.com/api-keys first.");
  if (s === "placeholder") die("RESEND_API_KEY is still the repo placeholder, not a real key (real ones start `re_`).");
}

/** Resend returns the records it wants; we print them rather than paraphrase.
 *  A DNS record retyped from memory is a DNS record that silently does nothing. */
function printRecords(records) {
  if (!records?.length) {
    console.log("  (Resend returned no records — re-run `add` or check the dashboard.)");
    return;
  }
  for (const r of records) {
    console.log(`\n  ${r.record}  ${r.type}`);
    console.log(`    name     ${r.name}`);
    console.log(`    value    ${r.value}`);
    if (r.priority != null) console.log(`    priority ${r.priority}`);
    if (r.ttl) console.log(`    ttl      ${r.ttl}`);
    if (r.status) console.log(`    status   ${r.status}`);
  }
}

async function findDomain() {
  const { status, body } = await resend("/domains");
  if (status !== 200) die(`Resend refused the key list request (HTTP ${status}): ${body.message || "no message"}`);
  return (body.data || []).find((d) => d.name === DOMAIN) || null;
}

async function cmdStatus() {
  console.log(`\n  Domain            ${DOMAIN}`);
  console.log(`  RESEND_API_KEY    ${keyState()}`);
  console.log(`  EMAIL_FROM        ${process.env.EMAIL_FROM?.trim() || "unset (falls back to Resend's sandbox sender)"}`);
  console.log(`  CLOUDFLARE token  ${CF ? "present" : "absent (the `dns` step will not run)"}`);

  if (keyState() !== "present") {
    console.log(`\n  Nothing can send until a real key is set. Next: resend.com → API Keys → create.\n`);
    return;
  }
  const d = await findDomain();
  if (!d) {
    console.log(`\n  ${DOMAIN} is NOT registered on this Resend account. Next: \`add\`.\n`);
    return;
  }
  console.log(`\n  Resend domain     ${d.id}  status=${d.status}  region=${d.region}`);
  if (d.status !== "verified") {
    console.log(`\n  Not verified yet. The DNS records must exist and match; then run \`verify\`.\n`);
  } else {
    console.log(`\n  Verified. Set EMAIL_FROM to "AEC-Flow <noreply@${DOMAIN}>" and sends will work.\n`);
  }
}

async function cmdAdd() {
  requireKey();
  const existing = await findDomain();
  if (existing) {
    console.log(`\n  ${DOMAIN} is already registered (${existing.id}, status=${existing.status}).`);
    const { body } = await resend(`/domains/${existing.id}`);
    printRecords(body.records);
    console.log(`\n  Add these in Cloudflare (or run \`dns\`), then \`verify\`.\n`);
    return;
  }
  const { status, body } = await resend("/domains", {
    method: "POST",
    body: JSON.stringify({ name: DOMAIN }),
  });
  if (status >= 300) die(`Resend refused to add ${DOMAIN} (HTTP ${status}): ${body.message || "no message"}`);
  console.log(`\n  Registered ${DOMAIN} (${body.id}). DNS records to create:`);
  printRecords(body.records);
  console.log(`\n  Add them in Cloudflare (or run \`dns\`), then \`verify\`.\n`);
}

async function cmdDns() {
  requireKey();
  if (!CF) die("CLOUDFLARE_API_TOKEN is not set. It needs Zone:DNS:Edit on the aec-flow.com zone.");

  const d = await findDomain();
  if (!d) die(`${DOMAIN} is not registered on Resend yet — run \`add\` first.`);
  const { body: detail } = await resend(`/domains/${d.id}`);
  const records = detail.records || [];
  if (!records.length) die("Resend returned no records to write.");

  const zoneRes = await cloudflare(`/zones?name=${encodeURIComponent(DOMAIN)}`);
  const zone = zoneRes.body?.result?.[0];
  if (!zone) die(`Cloudflare has no zone called ${DOMAIN} (or the token cannot see it).`);
  console.log(`\n  Cloudflare zone ${zone.id}`);

  const existingRes = await cloudflare(`/zones/${zone.id}/dns_records?per_page=200`);
  const existing = existingRes.body?.result || [];

  for (const r of records) {
    // Resend gives host-relative names for some records and absolute for others.
    const name = r.name.endsWith(DOMAIN) ? r.name : `${r.name}.${DOMAIN}`;
    const payload = {
      type: r.type,
      name,
      content: r.value,
      ttl: 1, // "automatic"
      ...(r.priority != null ? { priority: r.priority } : {}),
    };

    // Update in place rather than add: a second TXT at the same name is not an
    // error to Cloudflare and is an unverifiable domain to Resend.
    const match = existing.find((e) => e.type === r.type && e.name === name);
    const { status, body } = match
      ? await cloudflare(`/zones/${zone.id}/dns_records/${match.id}`, { method: "PUT", body: JSON.stringify(payload) })
      : await cloudflare(`/zones/${zone.id}/dns_records`, { method: "POST", body: JSON.stringify(payload) });

    if (status >= 300 || body.success === false) {
      console.log(`  ✗ ${r.type} ${name} — ${body.errors?.[0]?.message || `HTTP ${status}`}`);
    } else {
      console.log(`  ✓ ${r.type} ${name} ${match ? "(updated)" : "(created)"}`);
    }
  }
  console.log(`\n  Records written. DNS needs a few minutes; then run \`verify\`.\n`);
}

async function cmdVerify() {
  requireKey();
  const d = await findDomain();
  if (!d) die(`${DOMAIN} is not registered on Resend — run \`add\` first.`);
  const { status, body } = await resend(`/domains/${d.id}/verify`, { method: "POST" });
  if (status >= 300) die(`Verification request failed (HTTP ${status}): ${body.message || "no message"}`);

  const { body: after } = await resend(`/domains/${d.id}`);
  console.log(`\n  ${DOMAIN} status=${after.status}`);
  if (after.status !== "verified") {
    console.log("  Records not satisfied yet. Which ones:");
    printRecords((after.records || []).filter((r) => r.status !== "verified"));
    console.log("\n  DNS can take up to an hour. Re-run `verify`.\n");
    process.exitCode = 2;
    return;
  }
  console.log(`\n  Verified. Set in Vercel production:`);
  console.log(`    EMAIL_FROM="AEC-Flow <noreply@${DOMAIN}>"`);
  console.log(`    RESEND_API_KEY=<the key>`);
  console.log(`  then redeploy and run \`test <address>\`.\n`);
}

async function cmdTest(to) {
  requireKey();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) die("Give one address: `test you@example.com`");

  const from = process.env.EMAIL_FROM?.trim() || `AEC-Flow <onboarding@resend.dev>`;
  const { status, body } = await resend("/emails", {
    method: "POST",
    body: JSON.stringify({
      from,
      to,
      subject: "AEC-flow email test",
      text:
        "This is the AEC-flow email test.\n\n" +
        "If you are reading it, server-side sending works and the Send button in " +
        "the app will deliver for real.\n",
    }),
  });

  // The one rule from lib/server/document-email.ts, repeated here on purpose:
  // success is an id coming back, not the absence of an error.
  if (status >= 300 || !body.id) {
    die(`Not sent (HTTP ${status}): ${body.message || JSON.stringify(body)}`);
  }
  console.log(`\n  ✓ Sent from ${from} to ${to} — message id ${body.id}\n`);
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case "status": await cmdStatus(); break;
  case "add": await cmdAdd(); break;
  case "dns": await cmdDns(); break;
  case "verify": await cmdVerify(); break;
  case "test": await cmdTest(arg); break;
  default:
    console.log(`
  node scripts/email-setup.mjs status          what is configured, what is not
  node scripts/email-setup.mjs add             register ${DOMAIN} on Resend, print its DNS records
  node scripts/email-setup.mjs dns             write those records into Cloudflare
  node scripts/email-setup.mjs verify          ask Resend to re-check them
  node scripts/email-setup.mjs test <address>  send one real email
`);
}
