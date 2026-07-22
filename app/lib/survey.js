// 質問データの型定義と正規化。API・ストア・各ページで共通利用する。

export const TYPES = ["text", "paragraph", "choice", "checkbox", "scale"];

export const TYPE_LABEL = {
  text: "記述式（短い回答）",
  paragraph: "段落（自由記述）",
  choice: "ラジオ（1つ選択）",
  checkbox: "チェックボックス（複数選択）",
  scale: "段階評価",
};

// 1問を安全な形にそろえる
export function normalizeQuestion(q) {
  const type = TYPES.includes(q?.type) ? q.type : "text";
  const out = {
    type,
    title: typeof q?.title === "string" ? q.title.trim() : "",
    required: q?.required === true,
    help: typeof q?.help === "string" ? q.help.trim() : "",
  };
  if (type === "choice" || type === "checkbox") {
    out.options = Array.isArray(q?.options)
      ? q.options.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim())
      : [];
  }
  if (type === "scale") {
    out.scaleMax = Number.isInteger(q?.scaleMax) && q.scaleMax >= 2 && q.scaleMax <= 10 ? q.scaleMax : 5;
    if (Array.isArray(q?.scaleLabels) && q.scaleLabels.length === 2) {
      out.scaleLabels = q.scaleLabels.map((s) => String(s));
    }
  }
  return out;
}

export function normalizeQuestions(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map(normalizeQuestion)
    .filter((q) => q.title);
}

// AIが返したフォーム1つを安全な形にそろえる
export function cleanForm(f, fallbackTitle) {
  const src = f && typeof f === "object" ? f : {};
  return {
    title: typeof src.title === "string" && src.title.trim() ? src.title.trim() : fallbackTitle,
    description: typeof src.description === "string" ? src.description.trim() : "",
    questions: normalizeQuestions(src.questions),
  };
}
