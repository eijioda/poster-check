import { getSurvey, updateSurvey } from "../../../lib/surveyStore";

export const runtime = "nodejs";

// 回答ページ・編集ページ用。回答データ(responses)は含めない。
export async function GET(request, { params }) {
  const { id } = await params;
  const s = await getSurvey(id);
  if (!s) {
    return Response.json({ error: "アンケートが見つかりません。" }, { status: 404 });
  }
  return Response.json({
    id: s.id,
    title: s.title,
    description: s.description,
    questions: s.questions,
  });
}

// 編集の保存
export async function PUT(request, { params }) {
  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  }
  const saved = await updateSurvey(id, body);
  if (!saved) {
    return Response.json({ error: "アンケートが見つかりません。" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    id: saved.id,
    title: saved.title,
    description: saved.description,
    questions: saved.questions,
  });
}
