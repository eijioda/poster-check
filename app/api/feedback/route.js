// チェック結果から「ディレクターがアミーゴにLINEで送るFB文」を作る。
//
// ポスター画像は使わない。保存済みのチェック結果（checkStore）だけを材料にするので
// 速くて安い（2秒前後・0.1円未満）。言い方や長さを変えて何度でも作り直せる。
//
// OPENAI_API_KEY が無いときは、AIを使わずテンプレートで組み立てて返す（demo: true）。
// 設計: docs/design-v2.md 5章

import { getCheck } from "../../lib/checkStore";

export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const TONE_TEXT = {
  gentle:
    "やさしめ。初めての子や1年生向け。クッションを厚くし、必須のことだけをできるだけやわらかく伝える。",
  normal: "ふつう。ふだんのやりとり。丁寧だが冗長にしない。",
  firm:
    "しっかり。公開直前で時間がない場面。期限をはっきり示し、直す必要があることを明確に伝える。ただし人格や能力には一切触れない。",
};

// 長さは「何文字か」だけでなく「どの指摘まで入れるか」も決める。
// 短くする＝優先順位の低い指摘を落として、添削ページのリンクに逃がす。
const LENGTH_SPEC = {
  short: { chars: 150, mustFix: 2, niceToHave: 0, why: false },
  normal: { chars: 300, mustFix: 99, niceToHave: 1, why: false },
  long: { chars: 500, mustFix: 99, niceToHave: 99, why: true },
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "リクエストを読み取れませんでした。" }, { status: 400 });
  }

  // --- チェック結果を用意（保存済みIDか、その場のデータか） ---
  let check = null;
  if (body?.checkId) {
    check = await getCheck(body.checkId);
  }
  if (!check && body?.check && Array.isArray(body.check.findings)) {
    check = body.check;
  }
  if (!check) {
    return Response.json(
      { error: "チェック結果が見つかりませんでした。もう一度チェックしてください。" },
      { status: 404 }
    );
  }

  const allFindings = Array.isArray(check.findings) ? check.findings : [];
  const passed = Array.isArray(check.passed) ? check.passed : [];

  // --- 送る指摘を、送る順に取り出す ---
  const order = Array.isArray(body?.order)
    ? body.order.filter((i) => Number.isInteger(i) && i >= 0 && i < allFindings.length)
    : allFindings.map((_, i) => i);
  if (order.length === 0) {
    return Response.json(
      { error: "伝える指摘が1つも選ばれていません。" },
      { status: 400 }
    );
  }

  const selected = order.map((i) => allFindings[i]);
  const boundary = clampInt(body?.mustFixCount, 0, selected.length, selected.length);

  const length = LENGTH_SPEC[body?.length] ? body.length : "normal";
  const spec = LENGTH_SPEC[length];
  const tone = TONE_TEXT[body?.tone] ? body.tone : "normal";

  // 長さに応じて絞る。落とした分は件数だけ伝えてリンクに逃がす。
  const mustFix = selected.slice(0, boundary).slice(0, spec.mustFix);
  const niceToHave = selected.slice(boundary).slice(0, spec.niceToHave);
  const omittedCount = selected.length - mustFix.length - niceToHave.length;

  const to = str(body?.to);
  const projectName = str(body?.projectName);
  const deadline = str(body?.deadline);
  const link = body?.withLink ? str(body?.link) : "";

  const payload = {
    to,
    projectName,
    deadline,
    link,
    tone,
    length,
    summary: str(check.summary),
    passed: passed.slice(0, 5),
    mustFix,
    niceToHave,
    omittedCount,
    spec,
  };

  // --- APIキーが無ければテンプレートで組み立てる（デモ動作） ---
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const parts = templateParts(payload);
    const message = assemble(parts, payload);
    return Response.json({
      message,
      parts,
      charCount: [...message].length,
      costYen: 0,
      demo: true,
    });
  }

  const systemPrompt = buildSystemPrompt(payload);
  const userPrompt = buildUserPrompt(payload);

  let res;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
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

  const parts = {
    greeting: str(parsed?.greeting),
    good: strList(parsed?.good),
    mustFix: fixList(parsed?.mustFix),
    niceToHave: fixList(parsed?.niceToHave),
    closing: str(parsed?.closing),
  };

  // 本文はAIのものを使うが、空なら partsから組み立てて必ず何かを返す
  let message = str(parsed?.message) || assemble(parts, payload);
  // リンクは落とされやすいので、付ける設定なら確実に末尾へ
  if (link && !message.includes(link)) {
    message = `${message}\n\n${link}`;
  }

  let costYen = null;
  const usage = data?.usage;
  if (usage) {
    const usd =
      (usage.prompt_tokens || 0) * (2.5 / 1_000_000) +
      (usage.completion_tokens || 0) * (10 / 1_000_000);
    costYen = Math.ceil(usd * 155 * 100) / 100;
  }

  return Response.json({
    message,
    parts,
    charCount: [...message].length,
    costYen,
    demo: false,
  });
}

// ---------------- プロンプト ----------------

function buildSystemPrompt(p) {
  const lines = [
    "あなたは南魚沼市 mirai塾のディレクターです。",
    "中高生（アミーゴ）が作ったポスターへの指摘を、本人に LINE で送るメッセージに書き直してください。",
    "",
    "# 大原則",
    "- 相手は中学生・高校生。萎縮させない。ダメ出しの列挙にしない",
    "- 構成は「よかったところ」→「まず直してほしいところ」→「余裕があれば」→「ひとこと」",
    "- 直してほしいところは、必ず『どう直すか』をそのまま使える具体案まで書く",
    "- 「〜してください」より「〜してもらえると助かります」",
    "- 渡された指摘だけを使う。勝手に増やさない。順番も渡されたとおりに、①②③と番号をふる",
    "- ポスターを直接見ていないことを匂わせる表現（「とのことです」など）は書かない",
    "",
    `# 言い方`,
    `- ${TONE_TEXT[p.tone]}`,
    "",
    `# 長さ`,
    `- 全体で${p.spec.chars}字前後。`,
    p.spec.why
      ? "- それぞれ「直さないと誰がどう困るか」の理由まで書く"
      : "- 理由は短く。くどくしない",
    "",
    "# LINE向けの書き方",
    "- 改行を多めに。1段落は2〜3行まで",
    "- 絵文字は控えめ（0〜2個）。①②③の丸数字は積極的に使う",
    "- 箇条書きの記号は「・」より「①②③」",
    "- 件名やあいさつの定型（お疲れさまです等）は書かない。LINEなので用件から入る",
    "- URLは行の先頭に単独で置く",
  ];

  if (p.omittedCount > 0 && p.link) {
    lines.push(
      "",
      `# 省いた指摘について`,
      `- 今回は載せきらなかった指摘が${p.omittedCount}件ある。`,
      "  「ほかにも細かい点をいくつか見つけたので、よかったらこちらも見てね」と一言そえて、",
      "  末尾のリンクへ誘導すること。省いた指摘の中身は書かない",
    );
  }

  lines.push(
    "",
    "# 出力形式（このJSONのみ。説明文やコードブロックは不要）",
    "{",
    '  "greeting": "書き出しのあいさつ",',
    '  "good": ["よかったところ（1〜2個）"],',
    '  "mustFix": [{"no":1,"title":"見出し","how":"どう直すか","example":"そのまま使える文言（不要なら空文字）"}],',
    '  "niceToHave": [{"no":3,"title":"見出し","how":"どう直すか","example":""}],',
    '  "closing": "締めのひとこと",',
    '  "message": "上のすべてを組み立てた、そのままLINEに貼れる本文"',
    "}",
    "",
    "message が本体です。改行を含めて、コピーしてそのまま送れる状態にしてください。"
  );

  return lines.join("\n");
}

function buildUserPrompt(p) {
  const lines = [];
  lines.push(`宛名: ${p.to || "（名前なし。「ポスターありがとう！」のように宛名なしで書く）"}`);
  if (p.projectName) lines.push(`企画名: ${p.projectName}`);
  if (p.deadline) lines.push(`直してほしい期限: ${p.deadline}（締めのひとことに必ず入れる）`);
  if (p.summary) lines.push(`AIの総評（参考。そのまま引用しない）: ${p.summary}`);
  if (p.passed.length) {
    lines.push("", "ポスターで問題なく書けていた項目（ここから「よかったところ」を作る）:");
    for (const t of p.passed) lines.push(`- ${t}`);
  }

  lines.push("", "## まず直してほしいところ（この順番で①②…と番号をふる）");
  if (p.mustFix.length === 0) {
    lines.push("（なし。今回は必ず直すところは無いので、その旨を明るく伝える）");
  } else {
    p.mustFix.forEach((f, i) => {
      lines.push(
        `${i + 1}. ${f.title}`,
        `   状況: ${f.detail || "（詳細なし）"}`,
        `   修正案: ${f.suggestion || "（案なし。どう直すかを考えて書く）"}`
      );
    });
  }

  if (p.niceToHave.length > 0) {
    lines.push("", "## 余裕があれば（続きの番号をふる）");
    p.niceToHave.forEach((f, i) => {
      lines.push(
        `${p.mustFix.length + i + 1}. ${f.title}`,
        `   状況: ${f.detail || "（詳細なし）"}`,
        `   修正案: ${f.suggestion || ""}`
      );
    });
  }

  if (p.link) lines.push("", `末尾に置くリンク: ${p.link}`);

  return lines.join("\n");
}

// ---------------- テンプレート（APIキーなしのデモ動作） ----------------

function templateParts(p) {
  // 必須項目のラベルには「（固定値。異なる記載があれば…）」のような
  // ルール用の注釈が付いている。そのまま文面に出すと読めないので落とす。
  const good = p.passed.slice(0, 2).map((t) => t.replace(/[（(][^）)]*[）)]/g, "").trim());
  return {
    greeting: p.to ? `${p.to}さん、ポスターありがとう！` : "ポスターありがとう！",
    good: good.length
      ? [`${good.join("と")}がはっきり書けていて、分かりやすいです`]
      : ["作ってくれてありがとう！"],
    mustFix: p.mustFix.map((f, i) => ({
      no: i + 1,
      title: f.title || "",
      how: f.detail || "",
      example: f.suggestion || "",
    })),
    niceToHave: p.niceToHave.map((f, i) => ({
      no: p.mustFix.length + i + 1,
      title: f.title || "",
      how: f.detail || "",
      example: f.suggestion || "",
    })),
    closing: p.deadline
      ? `${p.deadline}までに直してもらえると助かります。分からないところがあったら聞いてね！`
      : "よろしくお願いします。分からないところがあったら聞いてね！",
  };
}

// parts から本文を組み立てる（AIが message を返さなかったときの保険でもある）
function assemble(parts, p) {
  const out = [];
  if (parts.greeting) out.push(parts.greeting, "");
  if (parts.good?.length) out.push(parts.good.join("\n"), "");

  if (parts.mustFix?.length) {
    out.push(
      parts.mustFix.length === 1
        ? "公開する前に、1つだけ直してほしいところがあります。"
        : `公開する前に、${parts.mustFix.length}つ直してほしいところがあります。`,
      ""
    );
    for (const f of parts.mustFix) {
      out.push(`${circled(f.no)} ${f.title}`);
      if (f.how) out.push(f.how);
      if (f.example) out.push(`→ ${f.example}`);
      out.push("");
    }
  }

  if (parts.niceToHave?.length) {
    out.push("余裕があれば、こちらも。", "");
    for (const f of parts.niceToHave) {
      out.push(`${circled(f.no)} ${f.title}`);
      if (f.how) out.push(f.how);
      if (f.example) out.push(`→ ${f.example}`);
      out.push("");
    }
  }

  if (p?.omittedCount > 0 && p?.link) {
    out.push("ほかにも細かい点をいくつか見つけたので、よかったらこちらも見てね。", "");
  }
  if (parts.closing) out.push(parts.closing);
  if (p?.link) out.push("", p.link);

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
function circled(n) {
  return CIRCLED[n - 1] || `${n}.`;
}

// ---------------- 小物 ----------------

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}
function strList(v) {
  return Array.isArray(v) ? v.filter((s) => typeof s === "string" && s.trim()) : [];
}
function fixList(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((f) => f && typeof f === "object")
    .map((f, i) => ({
      no: Number.isInteger(f.no) ? f.no : i + 1,
      title: str(f.title),
      how: str(f.how),
      example: str(f.example),
    }))
    .filter((f) => f.title);
}
function clampInt(v, min, max, fallback) {
  if (!Number.isInteger(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
