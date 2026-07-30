// 質問データの型定義と正規化。API・ストア・各ページで共通利用する。

export const TYPES = ["text", "paragraph", "choice", "checkbox", "scale"];

export const TYPE_LABEL = {
  text: "記述式（短い回答）",
  paragraph: "段落（自由記述）",
  choice: "ラジオ（1つ選択）",
  checkbox: "チェックボックス（複数選択）",
  scale: "段階評価",
};

// 質問の固定ID。並べ替え・編集しても回答が別の質問にズレないようにするため、
// 質問1つひとつに変わらないIDを持たせる（回答はこのIDで紐づく）。
export function genQid() {
  return "q_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

// 保存済み回答から、質問に対応する答えを取り出す。
// 新方式（qidキー）を優先し、旧方式（index キー）にもフォールバックする。
export function answerFor(answers, question, index) {
  if (!answers) return undefined;
  if (question?.qid && answers[question.qid] !== undefined) return answers[question.qid];
  return answers[index];
}

// 1問を安全な形にそろえる
export function normalizeQuestion(q) {
  const type = TYPES.includes(q?.type) ? q.type : "text";
  const out = {
    qid: typeof q?.qid === "string" && q.qid ? q.qid : genQid(),
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

// 名前らしい質問があるか
function hasNameQuestion(questions) {
  return (questions || []).some((q) =>
    /名前|氏名|なまえ|お名前/.test(q.title || "")
  );
}

// 事後アンケートに「必ず入れる項目」を保証する。
// AIが省いても、先頭にお名前（必須）を強制的に追加する。
// 満足度・感想・次回企画はプロンプト側で強く指示しているが、名前だけはここで確実に担保する。
export function ensureSurveyGuarantees(form) {
  const questions = Array.isArray(form.questions) ? [...form.questions] : [];
  if (!hasNameQuestion(questions)) {
    questions.unshift({
      qid: genQid(),
      type: "text",
      title: "お名前",
      required: true,
      help: "回答者のお名前をご記入ください。",
    });
  }
  return { ...form, questions };
}
