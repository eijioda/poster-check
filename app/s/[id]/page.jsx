"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RespondPage() {
  const { id } = useParams();
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [missing, setMissing] = useState(new Set());

  useEffect(() => {
    fetch(`/api/survey/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSurvey(d);
      })
      .catch(() => setError("読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, [id]);

  function setAnswer(i, value) {
    setAnswers((a) => ({ ...a, [i]: value }));
    // 入力したら「未回答」の印を外す
    setMissing((m) => {
      if (!m.has(i)) return m;
      const next = new Set(m);
      next.delete(i);
      return next;
    });
  }

  function toggleCheckbox(i, option) {
    setAnswers((a) => {
      const cur = Array.isArray(a[i]) ? a[i] : [];
      const next = cur.includes(option)
        ? cur.filter((o) => o !== option)
        : [...cur, option];
      return { ...a, [i]: next };
    });
    setMissing((m) => {
      if (!m.has(i)) return m;
      const next = new Set(m);
      next.delete(i);
      return next;
    });
  }

  async function submit() {
    // 送信前に必須の未回答をその場で知らせる（赤枠＋先頭へスクロール）
    const miss = new Set();
    for (let i = 0; i < survey.questions.length; i++) {
      const q = survey.questions[i];
      if (!q.required) continue;
      const k = q.qid || String(i);
      const a = answers[k];
      const empty =
        a === undefined ||
        a === null ||
        (typeof a === "string" && a.trim() === "") ||
        (Array.isArray(a) && a.length === 0);
      if (empty) miss.add(k);
    }
    if (miss.size > 0) {
      setMissing(miss);
      setError(`未回答の必須項目が ${miss.size} 件あります。赤枠の質問にご記入ください。`);
      const firstKey = [...miss][0];
      document.getElementById(`rq-${firstKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "送信に失敗しました。");
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main><p className="loading">読み込み中…</p></main>;
  if (error && !survey)
    return (
      <main>
        <div className="error">{error}</div>
      </main>
    );

  if (done)
    return (
      <main>
        <div className="thanks">
          <h1>ご回答ありがとうございました 🙌</h1>
          <p>回答を受け付けました。このページは閉じて大丈夫です。</p>
        </div>
      </main>
    );

  return (
    <main>
      <h1>{survey.title}</h1>
      {survey.description && <p className="form-desc">{survey.description}</p>}

      <div className="respond-form">
        {survey.questions.map((q, i) => {
          const k = q.qid || String(i);
          return (
          <div className={`respond-q${missing.has(k) ? " missing" : ""}`} id={`rq-${k}`} key={k}>
            <label className="respond-label">
              {q.title}
              {q.required && <span className="q-req">必須</span>}
            </label>
            {q.help && <div className="q-help">{q.help}</div>}

            {q.type === "text" && (
              <input
                className="rule-input"
                value={answers[k] || ""}
                onChange={(e) => setAnswer(k, e.target.value)}
              />
            )}

            {q.type === "paragraph" && (
              <textarea
                className="rule-textarea"
                value={answers[k] || ""}
                onChange={(e) => setAnswer(k, e.target.value)}
              />
            )}

            {q.type === "choice" &&
              (q.options || []).map((o, j) => (
                <label className="opt" key={j}>
                  <input
                    type="radio"
                    name={`q_${k}`}
                    checked={answers[k] === o}
                    onChange={() => setAnswer(k, o)}
                  />
                  {o}
                </label>
              ))}

            {q.type === "checkbox" &&
              (q.options || []).map((o, j) => (
                <label className="opt" key={j}>
                  <input
                    type="checkbox"
                    checked={Array.isArray(answers[k]) && answers[k].includes(o)}
                    onChange={() => toggleCheckbox(k, o)}
                  />
                  {o}
                </label>
              ))}

            {q.type === "scale" && (
              <div className="scale-row">
                {q.scaleLabels && <span className="scale-label">{q.scaleLabels[0]}</span>}
                {Array.from({ length: q.scaleMax || 5 }, (_, kk) => kk + 1).map((n) => (
                  <label className="scale-item" key={n}>
                    <input
                      type="radio"
                      name={`q_${k}`}
                      checked={answers[k] === n}
                      onChange={() => setAnswer(k, n)}
                    />
                    {n}
                  </label>
                ))}
                {q.scaleLabels && <span className="scale-label">{q.scaleLabels[1]}</span>}
              </div>
            )}
          </div>
          );
        })}
      </div>

      {error && <div className="error">{error}</div>}

      <button className="primary" onClick={submit} disabled={submitting}>
        {submitting ? "送信中…" : "回答を送信する"}
      </button>
    </main>
  );
}
