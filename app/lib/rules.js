import { readFile, writeFile } from "fs/promises";
import path from "path";

const RULES_PATH = path.join(process.cwd(), "rules.json");

const EMPTY = { replacements: [], required: [], qualitative: [] };

export async function readRules() {
  try {
    const raw = await readFile(RULES_PATH, "utf-8");
    const data = JSON.parse(raw);
    return normalize(data);
  } catch {
    return { ...EMPTY };
  }
}

export async function writeRules(data) {
  const clean = normalize(data);
  await writeFile(RULES_PATH, JSON.stringify(clean, null, 2), "utf-8");
  return clean;
}

// 入力を安全な形にそろえる（不正な項目は捨てる）
export function normalize(data) {
  const d = data || {};
  return {
    replacements: (Array.isArray(d.replacements) ? d.replacements : [])
      .map((r) => ({ from: str(r?.from), to: str(r?.to) }))
      .filter((r) => r.from || r.to),
    required: (Array.isArray(d.required) ? d.required : [])
      .map((r) => ({ label: str(r?.label), note: str(r?.note) }))
      .filter((r) => r.label),
    qualitative: (Array.isArray(d.qualitative) ? d.qualitative : [])
      .map((r) => ({ text: str(r?.text) }))
      .filter((r) => r.text),
  };
}

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

// チェック用プロンプトに埋め込むテキストを組み立てる
export function buildRulesText(rules) {
  const lines = ["# ポスターチェックルール", ""];

  lines.push("## ① 置換ルール（誤記・表記ゆれの訂正）", "");
  if (rules.replacements.length === 0) {
    lines.push("（なし）");
  } else {
    lines.push("以下の表記を見つけたら、右側への修正を error として指摘すること。", "");
    for (const r of rules.replacements) {
      lines.push(`- 「${r.from}」 → 「${r.to}」`);
    }
  }
  lines.push("");

  lines.push("## ② 必須項目（欠落チェック）", "");
  if (rules.required.length === 0) {
    lines.push("（なし）");
  } else {
    lines.push(
      "以下の項目がポスターに記載されているか確認し、欠落していれば error として指摘すること。",
      ""
    );
    for (const r of rules.required) {
      lines.push(`- ${r.label}${r.note ? `（${r.note}）` : ""}`);
    }
    lines.push(
      "",
      "「主催・運営・連絡先」は固定値が基本。異なる記載がある場合は error ではなく warning（要確認）とすること。"
    );
  }
  lines.push("");

  lines.push("## ③ 定性チェック（読みやすさ・分かりやすさ）", "");
  if (rules.qualitative.length === 0) {
    lines.push("（なし）");
  } else {
    for (const r of rules.qualitative) {
      lines.push(`- ${r.text}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
