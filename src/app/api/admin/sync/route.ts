import { timingSafeEqual } from "node:crypto";
import { syncDuke } from "@/server/sync";
import { failure } from "@/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  const expected = process.env.SYNC_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  if (!expected)
    return failure(
      "DISABLED",
      "Remote synchronization is not configured.",
      503,
    );
  const a = Buffer.from(supplied),
    b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return failure("UNAUTHORIZED", "Authentication required.", 401);
  try {
    return Response.json({ data: await syncDuke() });
  } catch {
    return failure(
      "SYNC_FAILED",
      "Import failed; the previous index has been preserved.",
      502,
    );
  }
}
