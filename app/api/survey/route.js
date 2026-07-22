import { cleanForm } from "../../lib/survey";
import { createSurvey } from "../../lib/surveyStore";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "OpenAIのAPIキーが設定されていません。\nposter-check/.env.local に OPENAI_API_KEY を記入してからサーバーを再起動してください。",
      },
      { status: 500 }
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "ファイルを受け取れませんでした。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return Response.json({ error: "ファイルが選択されていません。" }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) {
    return Response.json({ error: "PNG・JPG・PDFのみ対応しています。" }, { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const systemPrompt = `あなたは南魚沼市の地域イベントの運営担当です。
渡されたイベントのポスターを読み取り、そのイベント用に次の2種類のGoogleフォームの中身を作ってください。

1. registration（事前申込フォーム）: 参加を申し込むためのフォーム。氏名・連絡先・参加人数など、ポスターの内容に合った申込項目を作る。ポスターに定員や締め切りがあれば案内文に反映する。
2. survey（事後アンケート）: イベント終了後に回答してもらうアンケート。今回の満足度と、次回どんな企画がよいか（次回ニーズ）の両方をバランスよく含める。

# 出力形式（このJSONのみ。説明文やコードブロックは不要）

{
  "registration": {
    "title": "フォームの題名（イベント名を含める）",
    "description": "回答者向けの短い案内文",
    "questions": [
      {
        "type": "text | paragraph | choice | checkbox | scale のいずれか",
        "title": "質問文",
        "required": true または false,
        "help": "補足説明（不要なら空文字）",
        "options": ["choice/checkboxのときの選択肢", ...],
        "scaleMax": 5,
        "scaleLabels": ["最低の説明", "最高の説明"]
      }
    ]
  },
  "survey": { registrationと同じ構造 }
}

# 質問タイプの使い分け
- text: 氏名・電話番号など短い記述
- paragraph: 感想・自由記述など長めの回答
- choice: 1つだけ選ぶ（ラジオボタン）
- checkbox: 複数選べる（次回やってほしい企画など）
- scale: 満足度などの段階評価（scaleMaxは5、scaleLabelsは["とても不満","とても満足"]のように）

options・scaleMax・scaleLabels は、そのタイプで必要なときだけ入れてください。
日本語で、地域の住民が答えやすい自然な言葉づかいにしてください。`;

  const fileContent = isPdf
    ? {
        type: "file",
        file: {
          filename: file.name || "poster.pdf",
          file_data: `data:application/pdf;base64,${base64}`,
        },
      }
    : {
        type: "image_url",
        image_url: { url: `data:${file.type};base64,${base64}`, detail: "high" },
      };

  const body = {
    model: process.env.OPENAI_MODEL || "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "このポスターのイベント用に、2つのフォームを作ってください。" },
          fileContent,
        ],
      },
    ],
  };

  let res;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return Response.json(
      { error: `OpenAI APIへの接続に失敗しました: ${e.message}` },
      { status: 502 }
    );
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

  const registration = cleanForm(parsed.registration, "申込フォーム");
  const survey = cleanForm(parsed.survey, "アンケート");

  let costYen = null;
  const usage = data?.usage;
  if (usage) {
    const usd =
      (usage.prompt_tokens || 0) * (2.5 / 1_000_000) +
      (usage.completion_tokens || 0) * (10 / 1_000_000);
    costYen = Math.ceil(usd * 155 * 10) / 10;
  }

  // 2つのフォームを保存し、それぞれのIDを返す（リンクはブラウザ側で組み立てる）
  const regRec = await createSurvey(registration);
  const surRec = await createSurvey(survey);

  const strip = (rec, kind) => ({
    kind,
    id: rec.id,
    title: rec.title,
    description: rec.description,
    questions: rec.questions,
  });

  return Response.json({
    forms: [strip(regRec, "registration"), strip(surRec, "survey")],
    costYen,
  });
}
