import { duplicateDevelopmentProject } from "@/lib/data/development";
import { created, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const result = await duplicateDevelopmentProject(id);
    return created(result);
  } catch (err) {
    return fail(err);
  }
}
