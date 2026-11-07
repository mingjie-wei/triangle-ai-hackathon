import { handle } from "@/server/http";
export const runtime = "nodejs";
export function GET(request: Request) {
  return handle(request, "locations");
}
