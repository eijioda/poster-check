import { cleanForm, ensureSurveyGuarantees } from "../../lib/survey";
import { createSurvey } from "../../lib/surveyStore";
import { buildFormsAppsScript } from "../../lib/appsScript";
import { appendRows, sheetsEnabled } from "../../lib/sheets";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "OpenAIのAPIキーが設定されていません。\n.env.local（本番はVercelの環境変数）に OPENAI_API_KEY を設定してください。",
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

  // 追加入力
  const creator = (form.get("creator") || "").toString().trim();
  const instruction = (form.get("instruction") || "").toString().trim();
  const applyReg = form.get("applyReg") === "true";
  const applySurvey = form.get("applySurvey") === "true";

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  // 追加指示の文面（反映先ごと）
  const regInstruction =
    instruction && applyReg
      ? `\n\n事前申込フォームには、次のユーザー追加指示も必ず反映してください: ${instruction}`
      : "";
  const surveyInstruction =
    instruction && applySurvey
      ? `\n\n事後アンケートには、次のユーザー追加指示も必ず反映してください: ${instruction}`
      : "";

  const systemPrompt = `あなたは南魚沼市の地域イベントの運営担当です。
渡されたイベントのポスターを読み取り、そのイベント用に次の2種類のGoogleフォームの中身と、イベント情報を作ってください。

1. registration（事前申込フォーム）: 参加を申し込むためのフォーム。氏名・連絡先・参加人数など、ポスターの内容に合った申込項目を作る。ポスターに定員や締め切りがあれば案内文に反映する。${regInstruction}
2. survey（事後アンケート）: イベント終了後に回答してもらうアンケート。次の4項目を必ず含めること:
   - お名前（type=text, required=true）
   - 満足度（type=scale, scaleMax=5, scaleLabels=["とても不満","とても満足"], required=true）
   - 感想・自由記述（type=paragraph）
   - 次回やってほしい企画（type=checkbox, 具体的な選択肢を4つ前後）${surveyInstruction}
3. event（イベント情報）: ポスターから読み取れる範囲で。読み取れない項目は空文字にする。

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
  "survey": { registrationと同じ構造 },
  "event": {
    "workshopName": "ワークショップ名（イベント名）",
    "eventDate": "実施日（例: 2025年8月10日(土)）",
    "capacity": "募集人数・定員（例: 20組。無ければ空文字）",
    "deadline": "募集締め切り（例: 8月5日。無ければ空文字）"
  }
}

# 質問タイプの使い分け
- text: 氏名・電話番号など短い記述
- paragraph: 感想・自由記述など長めの回答
- choice: 1つだけ選ぶ（ラジオボタン）
- checkbox: 複数選べる（次回やってほしい企画など）
- scale: 満足度などの段階評価

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
          { type: "text", text: "このポスターのイベント用に、2つのフォームとイベント情報を作ってください。" },
          fileContent,
        ],
      },
    ],
  };

  let res;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
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

  const registration = cleanForm(parsed.registration, "申込フォーム");
  // 事後アンケートは「お名前（必須）」を必ず保証する
  const survey = ensureSurveyGuarantees(cleanForm(parsed.survey, "アンケート"));

  const ev = parsed.event && typeof parsed.event === "object" ? parsed.event : {};
  const event = {
    workshopName: str(ev.workshopName) || registration.title || "",
    eventDate: str(ev.eventDate),
    capacity: str(ev.capacity),
    deadline: str(ev.deadline),
  };

  let costYen = null;
  const usage = data?.usage;
  if (usage) {
    const usd =
      (usage.prompt_tokens || 0) * (2.5 / 1_000_000) +
      (usage.completion_tokens || 0) * (10 / 1_000_000);
    costYen = Math.ceil(usd * 155 * 10) / 10;
  }

  // 2つのフォームを保存
  const regRec = await createSurvey(registration);
  const surRec = await createSurvey(survey);

  // 絶対URLを組み立てる（本番でも正しく）
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("host") || url.host;
  const origin = `${proto}://${host}`;
  const links = (id) => ({
    respond: `${origin}/s/${id}`,
    edit: `${origin}/s/${id}/edit`,
    results: `${origin}/s/${id}/results`,
  });

  // Googleフォーム生成スクリプト（保証済みの内容で）
  const formsScript = buildFormsAppsScript(
    { title: regRec.title, description: regRec.description, questions: regRec.questions },
    { title: surRec.title, description: surRec.description, questions: surRec.questions }
  );

  // スプレッドシートへ2行追記（未設定なら何もしない）
  const today = new Date().toISOString().slice(0, 10);
  let sheetSaved = false;
  if (sheetsEnabled()) {
    const rows = [
      sheetRow("事前申込フォーム", event, creator, today, links(regRec.id)),
      sheetRow("事後アンケート", event, creator, today, links(surRec.id)),
    ];
    sheetSaved = await appendRows(rows);
  }

  const strip = (rec, kind) => ({
    kind,
    id: rec.id,
    title: rec.title,
    description: rec.description,
    questions: rec.questions,
  });

  return Response.json({
    forms: [strip(regRec, "registration"), strip(surRec, "survey")],
    event,
    formsScript,
    sheetSaved,
    sheetsConfigured: sheetsEnabled(),
    costYen,
  });
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

// スプレッドシートの1行（基本列）
function sheetRow(kind, event, creator, today, l) {
  return {
    種別: kind,
    ワークショップ名: event.workshopName,
    実施日: event.eventDate,
    募集人数: event.capacity,
    募集締切: event.deadline,
    作成者名: creator,
    回答url: l.respond,
    編集url: l.edit,
    集計url: l.results,
  };
}
