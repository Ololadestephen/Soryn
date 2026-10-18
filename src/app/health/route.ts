import { readiness } from "../../server/readiness";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  return readiness();
}
