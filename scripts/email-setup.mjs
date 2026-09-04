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
// Env comes from `node --env-file-if-exists=.env` in the npm scripts, NOT from
// dotenv: `dotenv` is in neither dependencies nor devDependencies and resolves
// today only because Prisma happens to hoist it. Any dependency change would
// have broken all five mail:* scripts with ERR_MODULE_NOT_FOUND.

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

class Fatal extends Error {}

/**
 * `process.exit()` here tore the process down with Node's undici keep-alive
 * socket still open, which on Windows prints
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` after otherwise
 * correct output - noise that reads as a crash to whoever runs it. Throw
 * instead and let the dispatcher set the exit code on a drained event loop.
 */
function die(msg) {
  throw new Fatal(msg);
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

/** Returned instead of a domain when the key is valid but scoped to sending. */
const RESTRICTED = Symbol("restricted_api_key");

/**
 * A "Sending access" key can send email perfectly and cannot read /domains —
 * Resend answers `restricted_api_key`. Treating that as a dead key made `status`
 * exit(1) on a key that works, which is the same species of misdiagnosis this
 * script exists to end. `add`/`dns`/`verify` genuinely need full access, so they
 * still die; `status` reports and carries on.
 */
async function findDomain() {
  const { status, body } = await resend("/domains");
  if (body?.name === "restricted_api_key" || status === 403) return RESTRICTED;
  // A well-formed key the provider does not recognise. keyState() can only see
  // shape, so this is the first place the difference is knowable - say which of
  // the two it is, or the operator re-reads "present" and looks elsewhere.
  if (status === 400 || status === 401) {
    die(
      `RESEND_API_KEY is present but the provider rejects it (HTTP ${status}: ${body.message || "no message"}). ` +
        "Create a fresh key at resend.com/api-keys and replace it in .env.",
    );
  }
  if (status !== 200) die(`Resend refused the key list request (HTTP ${status}): ${body.message || "no message"}`);
  return (body.data || []).find((d) => d.name === DOMAIN) || null;
}

/** For the commands that cannot proceed on a sending-only key. */
async function findDomainOrDie() {
  const d = await findDomain();
  if (d === RESTRICTED) {
    die("This key has Sending access only, so it cannot read or change domains. Use a full-access key for this step.");
  }
  return d;
}

async function cmdStatus() {
  console.log(`\n  Domain            ${DOMAIN}`);
  console.log(`  RESEND_API_KEY    ${keyState()}`);
  const fromEnv = process.env.EMAIL_FROM?.trim();
  console.log(`  EMAIL_FROM        ${fromEnv || "UNSET — nothing can send until this is set"}`);
  if (fromEnv && !fromEnv.includes(`@${DOMAIN}`)) {
    console.log(`                    not an address on ${DOMAIN}; the provider refuses it once the domain is verified`);
  }
  console.log(`  CLOUDFLARE token  ${CF ? "present" : "absent (the `dns` step will not run)"}`);

  if (keyState() !== "present") {
    console.log(`\n  Nothing can send until a real key is set. Next: resend.com → API Keys → create.\n`);
    return;
  }
  const d = await findDomain();
  if (d === RESTRICTED) {
    console.log(`
  Key is valid, Sending access only: it can send, but cannot read domains.`);
    console.log(`  Domain checks (add / dns / verify) need a full-access key.
`);
    return;
  }
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
  const existing = await findDomainOrDie();
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

  const d = await findDomainOrDie();
  if (!d) die(`${DOMAIN} is not registered on Resend yet — run \`add\` first.`);
  const { body: detail } = await resend(`/domains/${d.id}`);
  const records = detail.records || [];
  if (!records.length) die("Resend returned no records to write.");

  const zoneRes = await cloudflare(`/zones?name=${encodeURIComponent(DOMAIN)}`);
  const zone = zoneRes.body?.result?.[0];
  if (!zone) die(`Cloudflare has no zone called ${DOMAIN} (or the token cannot see it).`);
  console.log(`\n  Cloudflare zone ${zone.id}`);

  // Read every page, and treat a failed read as fatal. `?.result || []` silently
  // yielded [] on any error; every match then missed and every record was POSTed
  // — producing exactly the duplicate-TXT-at-one-name this function exists to
  // avoid, on the run least able to cope with it.
  const existing = [];
  for (let page = 1; ; page++) {
    const res = await cloudflare(`/zones/${zone.id}/dns_records?per_page=100&page=${page}`);
    if (res.status >= 300 || res.body?.success === false) {
      die(`Cloudflare refused to list the zone records: ${res.body?.errors?.[0]?.message || "HTTP " + res.status}`);
    }
    const batch = res.body?.result || [];
    existing.push(...batch);
    const info = res.body?.result_info;
    if (!info || !info.total_pages || page >= info.total_pages || batch.length === 0) break;
  }

  for (const r of records) {
    // Resend gives host-relative names for some records and absolute for others,
    // and "" or "@" for an apex record. A bare endsWith() turned "" into
    // ".aec-flow.com" (which Cloudflare rejects) and would accept the unrelated
    // "notaec-flow.com" as already absolute.
    const raw = (r.name ?? "").trim();
    const name =
      !raw || raw === "@"
        ? DOMAIN
        : raw === DOMAIN || raw.endsWith(`.${DOMAIN}`)
          ? raw
          : `${raw}.${DOMAIN}`;
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
    if (match && match.content === payload.content && (match.priority ?? null) === (payload.priority ?? null)) {
      console.log(`  = ${r.type} ${name} (already correct)`);
      continue;
    }
    // A destructive write to live DNS, parameterised by EMAIL_DOMAIN. Say what
    // is being replaced before replacing it.
    if (match) {
      console.log(`  ~ ${r.type} ${name}`);
      console.log(`      was  ${match.content}`);
      console.log(`      now  ${payload.content}`);
    }
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
  const d = await findDomainOrDie();
  if (!d) die(`${DOMAIN} is not registered on Resend — run \`add\` first.`);
  const { status, body } = await resend(`/domains/${d.id}/verify`, { method: "POST" });
  if (status >= 300) die(`Verification request failed (HTTP ${status}): ${body.message || "no message"}`);

  // Verification is asynchronous. Reading the status in the same breath as
  // requesting it returns `pending` almost every time, so this reported
  // "records not satisfied" and exited 2 on DNS that was in fact correct.
  let after = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await resend(`/domains/${d.id}`);
    after = res.body;
    if (after?.status === "verified" || after?.status === "failure") break;
    if (attempt < 5) {
      console.log(`  status=${after?.status ?? "unknown"} - waiting 10s (${attempt}/5)`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  console.log(`
  ${DOMAIN} status=${after?.status}`);
  if (after?.status !== "verified") {
    console.log("  Records not satisfied yet. Which ones:");
    printRecords((after?.records || []).filter((r) => r.status !== "verified"));
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
try {
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
} catch (e) {
  if (e instanceof Fatal) {
    console.error(`\n  x ${e.message}\n`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
