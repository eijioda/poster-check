import { getSurvey, getResponses } from "../../../../lib/surveyStore";

export const runtime = "nodejs";

// 集計・結果表示用（回答データを含む）
export async function GET(request, { params }) {
  const { id } = await params;
  const s = await getSurvey(id);
  if (!s) {
    return Response.json({ error: "アンケートが見つかりません。" }, { status: 404 });
  }
  const responses = await getResponses(id);
  return Response.json({
    id: s.id,
    title: s.title,
    description: s.description,
    questions: s.questions,
    responses,
  });
}
