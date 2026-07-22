"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TYPE_LABEL } from "../../../lib/survey";
import QrBlock from "../../../components/QrBlock";

const TYPES = ["text", "paragraph", "choice", "checkbox", "scale"];

export default function EditPage() {
  const { id } = useParams();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch(`/api/survey/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSurvey(d);
      })
      .catch(() => setError("読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, [id]);

  function change(next) {
    setSurvey(next);
    setDirty(true);
    setMessage(null);
  }

  function setQ(i, patch) {
    change({
      ...survey,
      questions: survey.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)),
    });
  }
  function addQ() {
    change({
      ...survey,
      questions: [...survey.questions, { type: "text", title: "", required: false, help: "" }],
    });
  }
  function removeQ(i) {
    change({ ...survey, questions: survey.questions.filter((_, idx) => idx !== i) });
  }
  function moveQ(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= survey.questions.length) return;
    const qs = [...survey.questions];
    [qs[i], qs[j]] = [qs[j], qs[i]];
    change({ ...survey, questions: qs });
  }

  function setOption(qi, oi, value) {
    const options = [...(survey.questions[qi].options || [])];
    options[oi] = value;
    setQ(qi, { options });
  }
  function addOption(qi) {
    setQ(qi, { options: [...(survey.questions[qi].options || []), ""] });
  }
  function removeOption(qi, oi) {
    setQ(qi, { options: (survey.questions[qi].options || []).filter((_, idx) => idx !== oi) });
  }

  function changeType(i, type) {
    const patch = { type };
    if ((type === "choice" || type === "checkbox") && !survey.questions[i].options) {
      patch.options = ["", ""];
    }
    if (type === "scale" && !survey.questions[i].scaleMax) {
      patch.scaleMax = 5;
    }
    setQ(i, patch);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/survey/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(survey),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "保存に失敗しました。");
      setSurvey(d);
      setDirty(false);
      setMessage("保存しました。回答用リンクにすぐ反映されます。");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main><p className="loading">読み込み中…</p></main>;
  if (error && !survey)
    return <main><div className="error">{error}</div></main>;

  const respondUrl = `${origin}/s/${id}`;
  const resultsUrl = `${origin}/s/${id}/results`;

  return (
    <main>
      <h1>アンケートの編集</h1>
      <p className="subtitle">
        ログイン不要です。このURLを知っている人なら誰でも編集できます。
      </p>

      <div className="link-box">
        <LinkRow label="回答用リンク（配布・QR用）" url={respondUrl} />
        <LinkRow label="集計・結果を見る" url={resultsUrl} />
      </div>
      <QrBlock id={id} />

      <section className="rule-section">
        <label className="respond-label">タイトル</label>
        <input
          className="rule-input"
          value={survey.title}
          onChange={(e) => change({ ...survey, title: e.target.value })}
        />
        <label className="respond-label" style={{ marginTop: "12px" }}>
          説明文（任意）
        </label>
        <textarea
          className="rule-textarea"
          value={survey.description}
          onChange={(e) => change({ ...survey, description: e.target.value })}
        />
      </section>

      {survey.questions.map((q, i) => (
        <section className="rule-section" key={i}>
          <div className="q-head">
            <strong>質問 {i + 1}</strong>
            <div className="q-head-btns">
              <button className="mini" onClick={() => moveQ(i, -1)} title="上へ">↑</button>
              <button className="mini" onClick={() => moveQ(i, 1)} title="下へ">↓</button>
              <button className="del" onClick={() => removeQ(i)} title="削除">🗑</button>
            </div>
          </div>

          <input
            className="rule-input"
            placeholder="質問文"
            value={q.title}
            onChange={(e) => setQ(i, { title: e.target.value })}
          />

          <div className="q-controls">
            <select
              className="rule-input"
              value={q.type}
              onChange={(e) => changeType(i, e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
            <label className="opt">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => setQ(i, { required: e.target.checked })}
              />
              必須
            </label>
          </div>

          <input
            className="rule-input note"
            placeholder="補足説明（任意）"
            value={q.help || ""}
            onChange={(e) => setQ(i, { help: e.target.value })}
          />

          {(q.type === "choice" || q.type === "checkbox") && (
            <div className="options-edit">
              <div className="q-help">選択肢</div>
              {(q.options || []).map((o, oi) => (
                <div className="rule-row" key={oi}>
                  <input
                    className="rule-input"
                    placeholder={`選択肢 ${oi + 1}`}
                    value={o}
                    onChange={(e) => setOption(i, oi, e.target.value)}
                  />
                  <button className="del" onClick={() => removeOption(i, oi)} title="削除">🗑</button>
                </div>
              ))}
              <button className="add" onClick={() => addOption(i)}>＋ 選択肢を追加</button>
            </div>
          )}

          {q.type === "scale" && (
            <div className="q-controls">
              <label className="q-help">
                最大値
                <input
                  className="rule-input scale-max"
                  type="number"
                  min="2"
                  max="10"
                  value={q.scaleMax || 5}
                  onChange={(e) => setQ(i, { scaleMax: parseInt(e.target.value, 10) || 5 })}
                />
              </label>
            </div>
          )}
        </section>
      ))}

      <button className="add" onClick={addQ}>＋ 質問を追加</button>

      <div className="save-bar">
        <button className="primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "保存中…" : dirty ? "保存する" : "保存済み"}
        </button>
        {message && <div className="summary">✅ {message}</div>}
        {error && <div className="error">{error}</div>}
      </div>
    </main>
  );
}

function LinkRow({ label, url }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <div className="link-row">
      <div className="link-meta">
        <span className="link-label">{label}</span>
        <a href={url} target="_blank" rel="noreferrer" className="link-url">{url}</a>
      </div>
      <button className="secondary mini-copy" onClick={copy}>
        {copied ? "コピー✓" : "コピー"}
      </button>
    </div>
  );
}
