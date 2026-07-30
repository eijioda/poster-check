import { cleanForm } from "../../../lib/survey";

export const runtime = "nodejs";
export const maxDuration = 120;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// 既存のアンケート内容に、自然言語の指示を反映して質問を書き換える。
// 画像は使わず、今の質問リスト＋指示だけで作り直す（編集画面のstateに反映して、保存は人が確認してから）。
export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OpenAIのAPIキーが設定されていません。" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "不正なリクエストです。" }, { status: 400 });
  }

  const instruction = (body?.instruction || "").toString().trim();
  if (!instruction) {
    return Response.json({ error: "修正の指示を入力してください。" }, { status: 400 });
  }

  const current = {
    title: typeof body?.title === "string" ? body.title : "",
    description: typeof body?.description === "string" ? body.description : "",
    questions: Array.isArray(body?.questions) ? body.questions : [],
  };

  const systemPrompt = `あなたはアンケート作成を手伝う編集アシスタントです。
「現在のアンケート」に、ユーザーの「修正指示」を反映して、アンケート全体を作り直してください。

# ルール
- 指示で触れられていない質問は、なるべくそのまま残す。
- 指示に応じて、質問の追加・削除・並べ替え・文言変更・タイプ変更・選択肢や必須の変更を行う。
- タイトルや説明文の変更を指示された場合はそれも反映する。
- 出力は必ず次のJSONのみ（説明やコードブロックは不要）。

{
  "title": "アンケートの題名",
  "description": "説明文",
  "questions": [
    {
      "type": "text | paragraph | choice | checkbox | scale のいずれか",
      "title": "質問文",
      "required": true または false,
      "help": "補足（不要なら空文字）",
      "options": ["choice/checkboxのときの選択肢"],
      "scaleMax": 5,
      "scaleLabels": ["最低の説明", "最高の説明"]
    }
  ]
}

options・scaleMax・scaleLabels は、そのタイプで必要なときだけ入れてください。日本語で自然な言葉づかいにしてください。`;

  const userContent = `# 現在のアンケート
${JSON.stringify(current, null, 2)}

# 修正指示
${instruction}`;

  const reqBody = {
    model: process.env.OPENAI_MODEL || "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  };

  let res;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    return Response.json({ error: `OpenAI APIへの接続に失敗しました: ${e.message}` }, { status: 502 });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    return Response.json({ error: `OpenAI APIエラー: ${msg}` }, { status: 502 });
  }

  let parsed;
  try {
    parsed = JSON.parse(data?.choices?.[0]?.message?.content || "");
  } catch {
    return Response.json(
      { error: "AIの応答を解析できませんでした。もう一度お試しください。" },
      { status: 502 }
    );
  }

  const revised = cleanForm(parsed, current.title || "アンケート");

  let costYen = null;
  const usage = data?.usage;
  if (usage) {
    const usd =
      (usage.prompt_tokens || 0) * (2.5 / 1_000_000) +
      (usage.completion_tokens || 0) * (10 / 1_000_000);
    costYen = Math.ceil(usd * 155 * 10) / 10;
  }

  return Response.json({ ...revised, costYen });
}
