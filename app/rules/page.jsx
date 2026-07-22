"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const EMPTY = { replacements: [], required: [], qualitative: [] };

export default function RulesPage() {
  const [rules, setRules] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then((d) => {
        if (d.rules) setRules({ ...EMPTY, ...d.rules });
        else setError(d.error || "読み込みに失敗しました。");
      })
      .catch(() => setError("読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  function update(next) {
    setRules(next);
    setDirty(true);
    setMessage(null);
  }

  // --- 置換ルール ---
  function setReplacement(i, key, value) {
    const list = rules.replacements.map((r, idx) =>
      idx === i ? { ...r, [key]: value } : r
    );
    update({ ...rules, replacements: list });
  }
  function addReplacement() {
    update({ ...rules, replacements: [...rules.replacements, { from: "", to: "" }] });
  }
  function removeReplacement(i) {
    update({ ...rules, replacements: rules.replacements.filter((_, idx) => idx !== i) });
  }

  // --- 必須項目 ---
  function setRequired(i, key, value) {
    const list = rules.required.map((r, idx) =>
      idx === i ? { ...r, [key]: value } : r
    );
    update({ ...rules, required: list });
  }
  function addRequired() {
    update({ ...rules, required: [...rules.required, { label: "", note: "" }] });
  }
  function removeRequired(i) {
    update({ ...rules, required: rules.required.filter((_, idx) => idx !== i) });
  }

  // --- 定性チェック ---
  function setQualitative(i, value) {
    const list = rules.qualitative.map((r, idx) =>
      idx === i ? { text: value } : r
    );
    update({ ...rules, qualitative: list });
  }
  function addQualitative() {
    update({ ...rules, qualitative: [...rules.qualitative, { text: "" }] });
  }
  function removeQualitative(i) {
    update({ ...rules, qualitative: rules.qualitative.filter((_, idx) => idx !== i) });
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "保存に失敗しました。");
      if (d.rules) setRules({ ...EMPTY, ...d.rules });
      setDirty(false);
      setMessage("保存しました。次のチェックから反映されます。");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main>
        <h1>チェックルールの編集</h1>
        <p className="loading">読み込み中…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>チェックルールの編集</h1>
      <p className="subtitle">
        欄を書き換えたり、追加・削除するだけでチェック内容を変えられます。{" "}
        <Link href="/">← チェック画面に戻る</Link>
      </p>

      {/* ① 置換ルール */}
      <section className="rule-section">
        <h2>① 表記の修正ルール</h2>
        <p className="rule-hint">
          左の言葉を見つけたら、右の言葉への修正を指摘します。（例: 南魚沼市内 → 南魚沼市の）
        </p>
        {rules.replacements.map((r, i) => (
          <div className="rule-row" key={i}>
            <input
              className="rule-input"
              placeholder="修正前の言葉"
              value={r.from}
              onChange={(e) => setReplacement(i, "from", e.target.value)}
            />
            <span className="arrow">→</span>
            <input
              className="rule-input"
              placeholder="正しい言葉"
              value={r.to}
              onChange={(e) => setReplacement(i, "to", e.target.value)}
            />
            <button className="del" onClick={() => removeReplacement(i)} title="削除">
              🗑
            </button>
          </div>
        ))}
        <button className="add" onClick={addReplacement}>
          ＋ 修正ルールを追加
        </button>
      </section>

      {/* ② 必須項目 */}
      <section className="rule-section">
        <h2>② ポスターに必ず載せる項目</h2>
        <p className="rule-hint">
          この項目が見当たらなければ「必須項目欠落」として指摘します。補足メモは任意です。
        </p>
        {rules.required.map((r, i) => (
          <div className="rule-row required-row" key={i}>
            <div className="required-fields">
              <input
                className="rule-input"
                placeholder="項目名（例: 開始時刻と終了時刻）"
                value={r.label}
                onChange={(e) => setRequired(i, "label", e.target.value)}
              />
              <input
                className="rule-input note"
                placeholder="補足メモ（任意）"
                value={r.note}
                onChange={(e) => setRequired(i, "note", e.target.value)}
              />
            </div>
            <button className="del" onClick={() => removeRequired(i)} title="削除">
              🗑
            </button>
          </div>
        ))}
        <button className="add" onClick={addRequired}>
          ＋ 必須項目を追加
        </button>
      </section>

      {/* ③ 定性チェック */}
      <section className="rule-section">
        <h2>③ 読みやすさ・分かりやすさのチェック</h2>
        <p className="rule-hint">
          AIが目で見て判断する観点です。文章で自由に書けます。
        </p>
        {rules.qualitative.map((r, i) => (
          <div className="rule-row" key={i}>
            <textarea
              className="rule-textarea"
              placeholder="チェックしたい観点を書いてください"
              value={r.text}
              onChange={(e) => setQualitative(i, e.target.value)}
            />
            <button className="del" onClick={() => removeQualitative(i)} title="削除">
              🗑
            </button>
          </div>
        ))}
        <button className="add" onClick={addQualitative}>
          ＋ チェック観点を追加
        </button>
      </section>

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
