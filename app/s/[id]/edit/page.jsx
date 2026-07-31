"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { TYPE_LABEL, genQid } from "../../../lib/survey";
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
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [bulkQid, setBulkQid] = useState(null);
  const [bulkText, setBulkText] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [focusOpt, setFocusOpt] = useState(null);
  const saveRef = useRef(null);
  const chatEndRef = useRef(null);

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

  // 未保存のまま離脱しようとしたら警告
  useEffect(() => {
    function onBeforeUnload(e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ⌘S / Ctrl+S で保存
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveRef.current?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function change(next) {
    setSurvey(next);
    setDirty(true);
    setMessage(null);
  }

  async function refine() {
    const instruction = refineText.trim();
    if (!instruction || !survey || refining) return;
    setRefining(true);
    setError(null);
    setAiChat((c) => [...c, { role: "user", text: instruction }]);
    setRefineText("");
    try {
      const res = await fetch("/api/survey/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: survey.title,
          description: survey.description,
          questions: survey.questions,
          instruction,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "修正に失敗しました。");
      change({ ...survey, title: d.title, description: d.description, questions: d.questions });
      setAiChat((c) => [
        ...c,
        { role: "ai", text: "修正しました。内容を確認して「保存する」で確定してください。" },
      ]);
    } catch (e) {
      setAiChat((c) => [...c, { role: "ai", text: `エラー: ${e.message}` }]);
    } finally {
      setRefining(false);
    }
  }

  // ---- 質問の操作 ----
  function setQ(i, patch) {
    change({ ...survey, questions: survey.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) });
  }
  function addQ() {
    change({
      ...survey,
      questions: [...survey.questions, { qid: genQid(), type: "text", title: "", required: false, help: "" }],
    });
  }
  function duplicateQ(i) {
    const src = survey.questions[i];
    const copy = { ...src, qid: genQid(), title: src.title ? src.title + "（コピー）" : "" };
    if (Array.isArray(src.options)) copy.options = [...src.options];
    if (Array.isArray(src.scaleLabels)) copy.scaleLabels = [...src.scaleLabels];
    const qs = [...survey.questions];
    qs.splice(i + 1, 0, copy);
    change({ ...survey, questions: qs });
  }
  function removeQ(i) {
    change({ ...survey, questions: survey.questions.filter((_, idx) => idx !== i) });
  }
  function moveQ(from, to) {
    if (to < 0 || to >= survey.questions.length) return;
    const qs = [...survey.questions];
    const [it] = qs.splice(from, 1);
    qs.splice(to, 0, it);
    change({ ...survey, questions: qs });
  }
  function onDrop(target) {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    moveQ(dragIndex, target);
    setDragIndex(null);
    setOverIndex(null);
  }

  // ---- 選択肢 ----
  function setOption(qi, oi, value) {
    const options = [...(survey.questions[qi].options || [])];
    options[oi] = value;
    setQ(qi, { options });
  }
  function addOption(qi) {
    const len = (survey.questions[qi].options || []).length;
    setQ(qi, { options: [...(survey.questions[qi].options || []), ""] });
    setFocusOpt({ qi, oi: len });
  }
  // 選択肢入力でEnter → 次の選択肢を追加して続けて入力できる
  function onOptionKey(e, qi) {
    if (e.key === "Enter") {
      e.preventDefault();
      addOption(qi);
    }
  }
  function removeOption(qi, oi) {
    setQ(qi, { options: (survey.questions[qi].options || []).filter((_, idx) => idx !== oi) });
  }
  function openBulk(q) {
    setBulkQid(q.qid);
    setBulkText((q.options || []).join("\n"));
  }
  function applyBulk(qi) {
    const lines = bulkText.split("\n").map((s) => s.trim()).filter(Boolean);
    setQ(qi, { options: lines });
    setBulkQid(null);
    setBulkText("");
  }

  function changeType(i, type) {
    const patch = { type };
    if ((type === "choice" || type === "checkbox") && !survey.questions[i].options) patch.options = ["", ""];
    if (type === "scale" && !survey.questions[i].scaleMax) patch.scaleMax = 5;
    setQ(i, patch);
  }

  async function save() {
    // 質問文が空だと保存時にその質問が消えてしまうため、先に知らせる
    const emptyIdx = (survey.questions || [])
      .map((q, i) => (!q.title || !q.title.trim() ? i + 1 : null))
      .filter((n) => n !== null);
    if (emptyIdx.length > 0) {
      setError(
        `質問文が空の質問があります（質問 ${emptyIdx.join("・")}）。入力するか、削除してから保存してください。`
      );
      return;
    }
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

  saveRef.current = save;

  // 吹き出しの会話を常に最新までスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [aiChat, refining, aiOpen]);

  if (loading) return <main><p className="loading">読み込み中…</p></main>;
  if (error && !survey) return <main><div className="error">{error}</div></main>;

  const respondUrl = `${origin}/s/${id}`;
  const resultsUrl = `${origin}/s/${id}/results`;

  return (
    <main>
      <div className="edit-head">
        <div>
          <h1>アンケートの編集</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            ログイン不要。このURLを知っている人なら誰でも編集できます。
          </p>
        </div>
        <div className="mode-toggle">
          <button className={preview ? "" : "on"} onClick={() => setPreview(false)}>編集</button>
          <button className={preview ? "on" : ""} onClick={() => setPreview(true)}>プレビュー</button>
        </div>
      </div>

      {!preview && (
        <div className="link-box">
          <LinkRow label="回答用リンク（配布・QR用）" url={respondUrl} />
          <LinkRow label="集計・結果を見る" url={resultsUrl} />
        </div>
      )}
      {!preview && <QrBlock id={id} />}

      {/* ===== プレビュー ===== */}
      {preview ? (
        <div className="respond-form">
          <div className="respond-q">
            <div className="form-title">{survey.title}</div>
            {survey.description && <div className="form-desc">{survey.description}</div>}
          </div>
          {survey.questions.map((q) => (
            <PreviewQuestion q={q} key={q.qid} />
          ))}
          <p className="rule-hint">これは回答者からの見え方です。「編集」に戻って調整できます。</p>
        </div>
      ) : (
        <>
          {/* ===== タイトル・説明 ===== */}
          <section className="rule-section">
            <label className="field-label">タイトル</label>
            <input className="rule-input" value={survey.title} onChange={(e) => change({ ...survey, title: e.target.value })} />
            <label className="field-label" style={{ marginTop: "12px" }}>説明文（任意）</label>
            <textarea className="rule-textarea" value={survey.description} onChange={(e) => change({ ...survey, description: e.target.value })} />
          </section>

          {/* ===== 質問カード ===== */}
          {survey.questions.map((q, i) => (
            <section
              className={`q-card${dragIndex === i ? " dragging" : ""}${overIndex === i && dragIndex !== null ? " dragover" : ""}`}
              key={q.qid}
              onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
              onDrop={() => onDrop(i)}
            >
              <div className="q-card-top">
                <span
                  className="drag-handle"
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                  title="ドラッグで並べ替え"
                >⠿</span>
                <span className="q-num">質問 {i + 1}</span>
                <div className="q-card-actions">
                  <button className="mini" onClick={() => moveQ(i, i - 1)} title="上へ">↑</button>
                  <button className="mini" onClick={() => moveQ(i, i + 1)} title="下へ">↓</button>
                  <button className="mini" onClick={() => duplicateQ(i)} title="複製">⧉</button>
                  <button className="del" onClick={() => removeQ(i)} title="削除">🗑</button>
                </div>
              </div>

              <input
                className="q-title-input"
                placeholder="質問文"
                value={q.title}
                onChange={(e) => setQ(i, { title: e.target.value })}
              />
              <input
                className="rule-input note"
                placeholder="補足説明（任意）"
                value={q.help || ""}
                onChange={(e) => setQ(i, { help: e.target.value })}
              />

              {/* タイプ別プレビュー編集 */}
              <div className="q-preview">
                {q.type === "text" && <div className="fake-input">記述式の回答欄</div>}
                {q.type === "paragraph" && <div className="fake-input tall">自由記述の回答欄</div>}

                {(q.type === "choice" || q.type === "checkbox") && (
                  <div className="opt-edit-list">
                    {(q.options || []).map((o, oi) => (
                      <div className="opt-edit-row" key={oi}>
                        <span className={`marker ${q.type}`} />
                        <input
                          className="rule-input"
                          placeholder={`選択肢 ${oi + 1}（Enterで次を追加）`}
                          value={o}
                          autoFocus={focusOpt?.qi === i && focusOpt?.oi === oi}
                          onKeyDown={(e) => onOptionKey(e, i)}
                          onChange={(e) => setOption(i, oi, e.target.value)}
                        />
                        <button className="del" onClick={() => removeOption(i, oi)} title="削除">🗑</button>
                      </div>
                    ))}
                    {bulkQid === q.qid ? (
                      <div className="bulk-box">
                        <textarea
                          className="rule-textarea"
                          placeholder="1行に1つずつ選択肢を書く（貼り付けもOK）"
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                        />
                        <div className="q-controls">
                          <button className="add" onClick={() => applyBulk(i)}>この内容にする</button>
                          <button className="add" onClick={() => setBulkQid(null)}>やめる</button>
                        </div>
                      </div>
                    ) : (
                      <div className="q-controls">
                        <button className="add" onClick={() => addOption(i)}>＋ 選択肢を追加</button>
                        <button className="add" onClick={() => openBulk(q)}>一括で貼り付け</button>
                      </div>
                    )}
                  </div>
                )}

                {q.type === "scale" && (
                  <div className="scale-edit">
                    <div className="scale-row">
                      {Array.from({ length: q.scaleMax || 5 }, (_, k) => k + 1).map((n) => (
                        <span className="scale-item preview" key={n}>{n}</span>
                      ))}
                    </div>
                    <div className="q-controls">
                      <label className="q-help">最大値
                        <input className="rule-input scale-max" type="number" min="2" max="10"
                          value={q.scaleMax || 5}
                          onChange={(e) => setQ(i, { scaleMax: parseInt(e.target.value, 10) || 5 })} />
                      </label>
                      <input className="rule-input note" style={{ maxWidth: "150px" }} placeholder="最小の説明（例: とても不満）"
                        value={q.scaleLabels?.[0] || ""}
                        onChange={(e) => setQ(i, { scaleLabels: [e.target.value, q.scaleLabels?.[1] || ""] })} />
                      <input className="rule-input note" style={{ maxWidth: "150px" }} placeholder="最大の説明（例: とても満足）"
                        value={q.scaleLabels?.[1] || ""}
                        onChange={(e) => setQ(i, { scaleLabels: [q.scaleLabels?.[0] || "", e.target.value] })} />
                    </div>
                  </div>
                )}
              </div>

              <div className="q-card-foot">
                <select className="rule-input" style={{ maxWidth: "220px" }} value={q.type} onChange={(e) => changeType(i, e.target.value)}>
                  {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
                <label className="check-inline">
                  <input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} />
                  必須
                </label>
              </div>
            </section>
          ))}

          <button className="add" onClick={addQ} style={{ marginTop: "8px" }}>＋ 質問を追加</button>
        </>
      )}

      <div className="save-bar">
        <button className="primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "保存中…" : dirty ? "保存する（⌘S）" : "保存済み"}
        </button>
        {dirty && !message && !error && (
          <div className="dirty-hint">未保存の変更があります</div>
        )}
        {message && <div className="summary">✅ {message}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      {/* ===== AIアシスタント（吹き出し） ===== */}
      {aiOpen && (
        <div className="ai-panel" role="dialog" aria-label="AIに修正を頼む">
          <div className="ai-panel-head">
            <span className="ai-panel-title">✨ AIに修正を頼む</span>
            <button className="ai-close" onClick={() => setAiOpen(false)} aria-label="閉じる">×</button>
          </div>
          <div className="ai-chat">
            {aiChat.length === 0 && (
              <div className="ai-bubble ai">
                やりたいことを書くと、質問をまとめて書き換えます。
                <div className="ai-examples">
                  {["所属学校を聞く質問を追加して", "満足度を10段階にして", "質問をもっと簡潔にして"].map((ex) => (
                    <button key={ex} className="ai-example" onClick={() => setRefineText(ex)}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiChat.map((m, i) => (
              <div className={`ai-bubble ${m.role}`} key={i}>{m.text}</div>
            ))}
            {refining && <div className="ai-bubble ai typing">AIが修正しています…</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="ai-input-row">
            <textarea
              className="ai-input"
              placeholder="例: 参加のきっかけを聞く質問を追加して"
              value={refineText}
              rows={2}
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  refine();
                }
              }}
            />
            <button className="ai-send" onClick={refine} disabled={refining || !refineText.trim()} aria-label="送信">
              ↑
            </button>
          </div>
        </div>
      )}
      <button
        className={`ai-fab${aiOpen ? " open" : ""}`}
        onClick={() => setAiOpen(!aiOpen)}
        aria-label="AIに修正を頼む"
      >
        {aiOpen ? "×" : "✨"}
      </button>
    </main>
  );
}

function PreviewQuestion({ q }) {
  return (
    <div className="respond-q">
      <label className="respond-label">
        {q.title || "（無題の質問）"}
        {q.required && <span className="q-req">必須</span>}
      </label>
      {q.help && <div className="q-help">{q.help}</div>}
      {q.type === "text" && <div className="fake-input">記述式の回答欄</div>}
      {q.type === "paragraph" && <div className="fake-input tall">自由記述の回答欄</div>}
      {(q.type === "choice" || q.type === "checkbox") &&
        (q.options || []).map((o, j) => (
          <label className="opt" key={j}>
            <span className={`marker ${q.type}`} />
            {o}
          </label>
        ))}
      {q.type === "scale" && (
        <div className="scale-row">
          {q.scaleLabels?.[0] && <span className="scale-label">{q.scaleLabels[0]}</span>}
          {Array.from({ length: q.scaleMax || 5 }, (_, k) => k + 1).map((n) => (
            <span className="scale-item" key={n}>{n}</span>
          ))}
          {q.scaleLabels?.[1] && <span className="scale-label">{q.scaleLabels[1]}</span>}
        </div>
      )}
    </div>
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
      <button className="secondary mini-copy" onClick={copy}>{copied ? "コピー✓" : "コピー"}</button>
    </div>
  );
}
