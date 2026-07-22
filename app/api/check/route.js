import { readRules, buildRulesText } from "../../lib/rules";

export const runtime = "nodejs";
export const maxDuration = 300;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "OpenAIのAPIキーが設定されていません。\nposter-check/.env.local を開き、OPENAI_API_KEY=sk-... の形でキーを記入してからサーバーを再起動してください。",
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
    return Response.json(
      { error: "PNG・JPG・PDFのみ対応しています。" },
      { status: 400 }
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const rules = buildRulesText(await readRules());

  const systemPrompt = `あなたは南魚沼市のイベントポスター・チラシの校閲担当です。
渡されたポスターを、以下のチェックルールに従って厳密に確認し、修正が必要な箇所をすべて指摘してください。

${rules}

# 出力形式

必ず次のJSON形式のみで出力してください（説明文やコードブロックは不要）:

{
  "summary": "ポスター全体の総評（1〜2文、日本語）",
  "passed": ["問題なく記載が確認できた必須項目名（例: 開始時刻と終了時刻）", ...],
  "findings": [
    {
      "severity": "error | warning | suggestion のいずれか",
      "title": "指摘の見出し（短く）",
      "detail": "何が問題か、ポスターのどの部分かを具体的に",
      "suggestion": "具体的な修正文案（そのまま使える文言で）"
    }
  ]
}

"passed" には、チェックルール②の必須項目のうちポスターに問題なく記載されていたものだけを列挙してください。

severityの基準:
- "error": 必須項目の欠落、置換ルールに該当する誤記など、直さないと公開できないもの
- "warning": 固定値（主催・運営・連絡先）と異なる記載、締め切り未記載の可能性など、確認が必要なもの
- "suggestion": 改行位置、イラストの見やすさ、名称の具体性・ダブルミーニングなどの改善提案

ポスターに実際に書かれている内容だけを根拠にしてください。読み取れない場合は無理に断定せず warning としてください。`;

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
          { type: "text", text: "このポスターをチェックしてください。" },
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
    return Response.json(
      { error: `OpenAI APIエラー: ${msg}` },
      { status: 502 }
    );
  }

  const text = data?.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "AIの応答を解析できませんでした。もう一度お試しください。" },
      { status: 502 }
    );
  }

  const findings = Array.isArray(parsed.findings)
    ? parsed.findings.filter(
        (f) =>
          f &&
          ["error", "warning", "suggestion"].includes(f.severity) &&
          typeof f.title === "string"
      )
    : [];

  const passed = Array.isArray(parsed.passed)
    ? parsed.passed.filter((p) => typeof p === "string")
    : [];

  // gpt-4o: 入力$2.5/100万トークン・出力$10/100万トークン、1ドル155円で概算
  let costYen = null;
  const usage = data?.usage;
  if (usage) {
    const usd =
      (usage.prompt_tokens || 0) * (2.5 / 1_000_000) +
      (usage.completion_tokens || 0) * (10 / 1_000_000);
    costYen = Math.ceil(usd * 155 * 10) / 10;
  }

  return Response.json({
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    passed,
    findings,
    costYen,
  });
}
