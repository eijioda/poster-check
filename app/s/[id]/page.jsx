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
  }

  function toggleCheckbox(i, option) {
    setAnswers((a) => {
      const cur = Array.isArray(a[i]) ? a[i] : [];
      const next = cur.includes(option)
        ? cur.filter((o) => o !== option)
        : [...cur, option];
      return { ...a, [i]: next };
    });
  }

  async function submit() {
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
        {survey.questions.map((q, i) => (
          <div className="respond-q" key={i}>
            <label className="respond-label">
              {q.title}
              {q.required && <span className="q-req">必須</span>}
            </label>
            {q.help && <div className="q-help">{q.help}</div>}

            {q.type === "text" && (
              <input
                className="rule-input"
                value={answers[i] || ""}
                onChange={(e) => setAnswer(i, e.target.value)}
              />
            )}

            {q.type === "paragraph" && (
              <textarea
                className="rule-textarea"
                value={answers[i] || ""}
                onChange={(e) => setAnswer(i, e.target.value)}
              />
            )}

            {q.type === "choice" &&
              (q.options || []).map((o, j) => (
                <label className="opt" key={j}>
                  <input
                    type="radio"
                    name={`q${i}`}
                    checked={answers[i] === o}
                    onChange={() => setAnswer(i, o)}
                  />
                  {o}
                </label>
              ))}

            {q.type === "checkbox" &&
              (q.options || []).map((o, j) => (
                <label className="opt" key={j}>
                  <input
                    type="checkbox"
                    checked={Array.isArray(answers[i]) && answers[i].includes(o)}
                    onChange={() => toggleCheckbox(i, o)}
                  />
                  {o}
                </label>
              ))}

            {q.type === "scale" && (
              <div className="scale-row">
                {q.scaleLabels && <span className="scale-label">{q.scaleLabels[0]}</span>}
                {Array.from({ length: q.scaleMax || 5 }, (_, k) => k + 1).map((n) => (
                  <label className="scale-item" key={n}>
                    <input
                      type="radio"
                      name={`q${i}`}
                      checked={answers[i] === n}
                      onChange={() => setAnswer(i, n)}
                    />
                    {n}
                  </label>
                ))}
                {q.scaleLabels && <span className="scale-label">{q.scaleLabels[1]}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <button className="primary" onClick={submit} disabled={submitting}>
        {submitting ? "送信中…" : "回答を送信する"}
      </button>
    </main>
  );
}
