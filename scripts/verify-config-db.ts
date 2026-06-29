import { getSystemCurrency, saveSystemCurrency, getPracticeSettings } from "../lib/server/practice-config";
import { getAnthropicKeyStatus } from "../lib/server/ai-config";
import { prisma } from "../lib/db";

let fail = 0;
const ck = (n: string, c: boolean) => { console.log(`${c ? "PASS" : "FAIL"}  ${n}`); if (!c) fail++; };

async function main() {
  ck("currency reads AWG from DB", (await getSystemCurrency()) === "AWG");
  const ps = await getPracticeSettings();
  ck("practice profile is generic (no ZenArch)", !/zenarch/i.test(JSON.stringify(ps.profile)));
  ck("footer ad persisted", /AEC Flow/i.test(ps.footer.text));
  ck("AI key available", (await getAnthropicKeyStatus()).configured === true);
  await saveSystemCurrency("EUR");
  ck("save persisted to DB (EUR)", (await getSystemCurrency()) === "EUR");
  await saveSystemCurrency("AWG");
  ck("restored to AWG", (await getSystemCurrency()) === "AWG");
  console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
