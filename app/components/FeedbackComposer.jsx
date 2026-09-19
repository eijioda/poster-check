"use client";

// チェック結果から「アミーゴにLINEで送るFB文」を作るパネル。
// 設計: docs/design-v2.md 4-1 / 5章
//
// ポイント
// - 伝える指摘を選べる・並べ替えられる（AIの順番を鵜呑みにさせない）
// - 「まず直す／余裕があれば」の境界を動かせる
// - 長さを短くすると、優先順位の低い指摘は本文から落ちて添削リンクへ逃げる
// - 生成後は必ず手直しできる

import { useEffect, useMemo, useRef, useState } from "react";

const SEV_ICON = { error: "❌", warning: "⚠️", suggestion: "💡" };
const SEV_RANK = { error: 0, warning: 1, suggestion: 2 };

const TONES = [
  { id: "gentle", label: "やさしめ" },
  { id: "normal", label: "ふつう" },
  { id: "firm", label: "しっかり" },
];
const LENGTHS = [
  { id: "short", label: "短め", hint: "まず直す上位2件だけ・150字前後" },
  { id: "normal", label: "ふつう", hint: "まず直す全部＋1件・300字前後" },
  { id: "long", label: "くわしい", hint: "全部＋理由まで・500字前後" },
];

export default function FeedbackComposer({
  findings = [],
  passed = [],
  summary = "",
  checkId = null,
  shareUrl = "",
  defaultTo = "",
  defaultProjectName = "",
}) {
  // 重要度順に並べ、❌⚠️は既定でON、💡は既定でOFF
  const initial = useMemo(() => {
    return findings
      .map((f, idx) => ({ idx, f }))
      .sort((a, b) => (SEV_RANK[a.f.severity] ?? 9) - (SEV_RANK[b.f.severity] ?? 9))
      .map(({ idx, f }) => ({ idx, on: f.severity !== "suggestion" }));
  }, [findings]);

  const [items, setItems] = useState(initial);
  // 境界の初期位置 = ❌⚠️の件数（ここまでが「まず直す」）
  const [boundary, setBoundary] = useState(
    () => initial.filter((it) => findings[it.idx]?.severity !== "suggestion").length
  );

  const [to, setTo] = useState(defaultTo);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [deadline, setDeadline] = useState("");
  const [tone, setTone] = useState("gentle");
  const [length, setLength] = useState("normal");
  const [withLink, setWithLink] = useState(Boolean(shareUrl));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState(null);
  const [copied, setCopied] = useState(false);
  const taRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => setTo(defaultTo), [defaultTo]);
  useEffect(() => setProjectName(defaultProjectName), [defaultProjectName]);

  // 本文の高さを中身に合わせる（スマホで全文が見えないと手直しできない）
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, 180)}px`;
  }, [message]);

  const onCount = items.filter((it) => it.on).length;
  const mustFixCount = items.slice(0, boundary).filter((it) => it.on).length;

  function move(pos, dir) {
    const next = pos + dir;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    [copy[pos], copy[next]] = [copy[next], copy[pos]];
    setItems(copy);
  }

  function toggle(pos) {
    setItems(items.map((it, i) => (i === pos ? { ...it, on: !it.on } : it)));
  }

  async function generate() {
    if (onCount === 0) {
      setError("伝える指摘を1つ以上選んでください。");
      return;
    }
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkId,
          // 保存に失敗していてもその場のデータで作れるようにする
          check: checkId ? undefined : { summary, passed, findings },
          to,
          projectName,
          deadline,
          order: items.filter((it) => it.on).map((it) => it.idx),
          mustFixCount,
          tone,
          length,
          withLink: Boolean(withLink && shareUrl),
          link: shareUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "FB文の作成に失敗しました。");
      setMessage(data.message || "");
      setMeta({ demo: data.demo, costYen: data.costYen });
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("コピーできませんでした。本文を長押しして選択してください。");
    }
  }

  const charCount = [...message].length;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(message)}`;

  if (findings.length === 0) return null;

  return (
    <section className="fb">
      <h2>💬 アミーゴに送るFB文を作る</h2>
      <p className="rule-hint">
        指摘をそのまま並べると「ダメ出しの山」に見えます。伝えるものを選んで、順番を決めてから作ります。
      </p>

      <div className="fb-fields">
        <label className="fb-field">
          <span className="field-label">アミーゴ</span>
          <input
            className="rule-input"
            placeholder="例: さくら"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label className="fb-field">
          <span className="field-label">企画名</span>
          <input
            className="rule-input"
            placeholder="例: 古着リメイク市"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
        </label>
        <label className="fb-field">
          <span className="field-label">直してほしい期限</span>
          <input
            className="rule-input"
            placeholder="例: 9/26(金)"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
      </div>

      <div className="fb-block">
        <div className="field-label">
          伝える指摘（{findings.length}件中{onCount}件）
        </div>
        <ul className="fb-list">
          {items.map((it, pos) => {
            const f = findings[it.idx];
            if (!f) return null;
            const isMust = pos < boundary;
            return (
              <li key={it.idx}>
                {pos === boundary && <Divider boundary={boundary} setBoundary={setBoundary} max={items.length} />}
                <div className={`fb-item ${it.on ? "" : "off"}`}>
                  <input
                    type="checkbox"
                    checked={it.on}
                    onChange={() => toggle(pos)}
                    aria-label={`${f.title} を伝える`}
                  />
                  <div className="fb-item-body">
                    <div className="fb-item-title">
                      {SEV_ICON[f.severity] || "・"} {f.title}
                    </div>
                    {f.suggestion && <div className="fb-item-sub">→ {f.suggestion}</div>}
                  </div>
                  <div className="fb-move">
                    <button type="button" onClick={() => move(pos, -1)} disabled={pos === 0} aria-label="上へ">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(pos, 1)}
                      disabled={pos === items.length - 1}
                      aria-label="下へ"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
          {boundary >= items.length && (
            <li>
              <Divider boundary={boundary} setBoundary={setBoundary} max={items.length} />
            </li>
          )}
        </ul>
      </div>

      <div className="fb-block">
        <div className="field-label">言い方</div>
        <Segmented options={TONES} value={tone} onChange={setTone} />
      </div>

      <div className="fb-block">
        <div className="field-label">長さ</div>
        <Segmented options={LENGTHS} value={length} onChange={setLength} />
        <div className="fb-hint">{LENGTHS.find((l) => l.id === length)?.hint}</div>
      </div>

      {shareUrl && (
        <label className="check-inline fb-linkcheck">
          <input type="checkbox" checked={withLink} onChange={(e) => setWithLink(e.target.checked)} />
          添削ページのリンクを末尾に付ける
        </label>
      )}

      <button className="primary" onClick={generate} disabled={loading || onCount === 0}>
        {loading ? "作成中…" : message ? "言い方を変えて作り直す" : "FB文をつくる"}
      </button>

      {error && <div className="error">{error}</div>}

      {message && (
        <div className="fb-result" ref={resultRef}>
          <div className="field-label">送る文章（このまま直せます）</div>
          <textarea
            ref={taRef}
            className="fb-text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="fb-meta">
            {charCount}文字
            {meta?.demo && <span className="fb-badge">デモ（AI未使用）</span>}
            {typeof meta?.costYen === "number" && meta.costYen > 0 && (
              <span className="fb-cost">約{meta.costYen}円</span>
            )}
          </div>
          <div className="fb-actions">
            <button className="primary fb-btn" onClick={copy}>
              {copied ? "コピーしました ✓" : "📋 コピー"}
            </button>
            <a className="secondary fb-btn" href={lineUrl} target="_blank" rel="noreferrer">
              💬 LINEで送る
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

// 「まず直す／余裕があれば」の境界線。上下ボタンで動かす（スマホでドラッグは外しやすい）
function Divider({ boundary, setBoundary, max }) {
  return (
    <div className="fb-divider">
      <span>ここまで「まず直す」／以下は「余裕があれば」</span>
      <div className="fb-move">
        <button type="button" onClick={() => setBoundary(Math.max(0, boundary - 1))} disabled={boundary === 0} aria-label="境界を上へ">
          ↑
        </button>
        <button type="button" onClick={() => setBoundary(Math.min(max, boundary + 1))} disabled={boundary >= max} aria-label="境界を下へ">
          ↓
        </button>
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? "on" : ""}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
