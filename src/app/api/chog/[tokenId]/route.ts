import { NextRequest } from "next/server";
import { getProfile } from "../../../../server/records/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tokenId: string }> },
) {
  return getProfile(request, (await context.params).tokenId);
}
