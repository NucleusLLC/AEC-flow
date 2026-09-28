import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
const APPLY = process.argv.includes("--apply");
const founder = await prisma.company.findFirst({ where: { isFounder: true }, select: { id: true, name: true } });
const orphanClient = await prisma.client.findFirst({ where: { companyId: null }, select: { id: true, name: true } });
const orphanProp = await prisma.proposal.findFirst({ where: { companyId: null }, select: { id: true, refNumber: true, title: true, clientId: true } });
console.log(`founder company : ${founder.id}  (${founder.name})`);
console.log(`orphan client   : ${orphanClient?.id} — ${orphanClient?.name}`);
console.log(`orphan proposal : ${orphanProp?.refNumber} — ${orphanProp?.title} (client ${orphanProp?.clientId})`);
console.log(`same client?    : ${orphanClient?.id === orphanProp?.clientId}`);
if (!APPLY) { console.log("\nDRY RUN — pass --apply to assign both to the founder company"); process.exit(0); }
if (orphanClient) await prisma.client.update({ where: { id: orphanClient.id }, data: { companyId: founder.id } });
if (orphanProp) await prisma.proposal.update({ where: { id: orphanProp.id }, data: { companyId: founder.id } });
const left = (await prisma.client.count({ where: { companyId: null } })) + (await prisma.proposal.count({ where: { companyId: null } }));
console.log(`\nassigned. remaining NULL-company rows: ${left}`);
await prisma.$disconnect();
