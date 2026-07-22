import { readRules, writeRules } from "../../lib/rules";

export const runtime = "nodejs";

export async function GET() {
  const rules = await readRules();
  return Response.json({ rules });
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  }
  if (!body?.rules || typeof body.rules !== "object") {
    return Response.json({ error: "ルールのデータがありません。" }, { status: 400 });
  }
  try {
    const saved = await writeRules(body.rules);
    return Response.json({ ok: true, rules: saved });
  } catch {
    return Response.json({ error: "rules.json に書き込めませんでした。" }, { status: 500 });
  }
}
