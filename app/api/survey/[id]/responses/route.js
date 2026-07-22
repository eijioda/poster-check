import { getSurvey, addResponse } from "../../../../lib/surveyStore";

export const runtime = "nodejs";

// 回答の送信（誰でも可・認証なし）
export async function POST(request, { params }) {
  const { id } = await params;
  const survey = await getSurvey(id);
  if (!survey) {
    return Response.json({ error: "アンケートが見つかりません。" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const answers = body?.answers && typeof body.answers === "object" ? body.answers : {};

  // 必須チェック（未回答があれば拒否）
  for (let i = 0; i < survey.questions.length; i++) {
    const q = survey.questions[i];
    if (!q.required) continue;
    const a = answers[i];
    const empty =
      a === undefined ||
      a === null ||
      (typeof a === "string" && a.trim() === "") ||
      (Array.isArray(a) && a.length === 0);
    if (empty) {
      return Response.json(
        { error: `「${q.title}」は必須です。` },
        { status: 400 }
      );
    }
  }

  await addResponse(id, answers);
  return Response.json({ ok: true });
}
