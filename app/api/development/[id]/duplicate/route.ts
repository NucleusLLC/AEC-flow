import { duplicateDevelopmentProject } from "@/lib/data/development";
import { created, fail } from "@/lib/development/api";
import { routeDenied } from "@/lib/server/route-gate";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const denied = await routeDenied("write");
  if (denied) return denied;
  const { id } = await params;
  try {
    const result = await duplicateDevelopmentProject(id);
    return created(result);
  } catch (err) {
    return fail(err);
  }
}
