import { getCheck } from "../../../lib/checkStore";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { id } = await params;
  const c = await getCheck(id);
  if (!c) {
    return Response.json({ error: "共有された添削結果が見つかりません。" }, { status: 404 });
  }
  return Response.json(c);
}
