import { handle } from "@/server/http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(request, "place", (await params).id);
}
