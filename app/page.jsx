"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QrBlock from "./components/QrBlock";

const SEVERITY_LABEL = {
  error: "❌ 必須項目欠落",
  warning: "⚠️ 要確認",
  suggestion: "💡 改善提案",
};

const TYPE_LABEL = {
  text: "記述式",
  paragraph: "段落（自由記述）",
  choice: "ラジオ（1つ選択）",
  checkbox: "チェックボックス（複数選択）",
  scale: "段階評価",
};

export default function Home() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [survey, setSurvey] = useState(null);
  const [surveyError, setSurveyError] = useState(null);
  const [origin, setOrigin] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function acceptFile(f) {
    if (!f) return;
    const ok =
      f.type === "application/pdf" || f.type.startsWith("image/");
    if (!ok) {
      setError("PNG・JPG・PDFのファイルを選んでください。");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("ファイルが大きすぎます（20MBまで）。");
      return;
    }
    setError(null);
    setResult(null);
    setSurvey(null);
    setSurveyError(null);
    setFile(f);
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function makeSurvey() {
    if (!file) return;
    setSurveyLoading(true);
    setSurveyError(null);
    setSurvey(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/survey", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アンケート作成に失敗しました。");
      setSurvey(data);
    } catch (e) {
      setSurveyError(e.message);
    } finally {
      setSurveyLoading(false);
    }
  }

  async function runCheck() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/check", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "チェックに失敗しました。");
      }
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadMarkdown() {
    if (!result) return;
    const lines = [`# ポスターチェック結果`, ""];
    if (file) lines.push(`ファイル: ${file.name}`, "");
    if (result.summary) lines.push(`## 総評`, "", result.summary, "");
    if (result.passed?.length) {
      lines.push(`## ✅ 確認できた項目`, "");
      for (const p of result.passed) lines.push(`- ${p}`);
      lines.push("");
    }
    for (const sev of ["error", "warning", "suggestion"]) {
      const items = (result.findings || []).filter((f) => f.severity === sev);
      if (items.length === 0) continue;
      lines.push(`## ${SEVERITY_LABEL[sev]}`, "");
      for (const f of items) {
        lines.push(`### ${f.title}`, "", f.detail || "");
        if (f.suggestion) lines.push("", `**修正案:** ${f.suggestion}`);
        lines.push("");
      }
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ポスターチェック結果.md";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const findings = result?.findings || [];

  return (
    <main>
      <h1>ポスターチェックAI</h1>
      <p className="subtitle">
        ポスター・チラシ（PNG / JPG / PDF）をアップロードすると、修正箇所をAIがピックアップします。{" "}
        <Link href="/rules">チェックルールを編集</Link>
      </p>

      <div
        className={`dropzone ${drag ? "drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          acceptFile(e.dataTransfer.files?.[0]);
        }}
      >
        <p>ここにファイルをドラッグ＆ドロップ、またはクリックして選択</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          hidden
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
        {file && <div className="filename">📄 {file.name}</div>}
        {previewUrl && <img className="preview" src={previewUrl} alt="プレビュー" />}
      </div>

      <button className="primary" onClick={runCheck} disabled={!file || loading}>
        {loading ? "チェック中…（30秒ほどかかります）" : "チェックする"}
      </button>

      {loading && <p className="loading">AIがポスターを確認しています…</p>}
      {error && <div className="error">{error}</div>}

      {result && (
        <>
          {result.summary && (
            <div className="summary">
              <strong>総評:</strong> {result.summary}
              {typeof result.costYen === "number" && (
                <div className="cost">今回のAPIコスト目安: 約{result.costYen}円</div>
              )}
            </div>
          )}
          {result.passed?.length > 0 && (
            <section className="group">
              <h2>✅ 確認できた項目（{result.passed.length}件）</h2>
              <div className="passed">
                {result.passed.map((p, i) => (
                  <span className="passed-item" key={i}>✓ {p}</span>
                ))}
              </div>
            </section>
          )}
          {["error", "warning", "suggestion"].map((sev) => {
            const items = findings.filter((f) => f.severity === sev);
            if (items.length === 0) return null;
            return (
              <section className="group" key={sev}>
                <h2>
                  {SEVERITY_LABEL[sev]}（{items.length}件）
                </h2>
                {items.map((f, i) => (
                  <div className={`finding ${sev}`} key={i}>
                    <div className="title">{f.title}</div>
                    {f.detail && <div className="detail">{f.detail}</div>}
                    {f.suggestion && (
                      <div className="suggestion-text">✏️ 修正案: {f.suggestion}</div>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
          {findings.length === 0 && (
            <div className="summary">指摘事項はありませんでした。</div>
          )}
          <button className="secondary" onClick={downloadMarkdown}>
            結果をMarkdownでダウンロード
          </button>
        </>
      )}

      {file && (
        <section className="survey-cta">
          <h2>アンケート・申込フォームを作る</h2>
          <p className="rule-hint">
            このポスターのイベント用に、「事前申込フォーム」と「事後アンケート」の質問をAIが考えて作ります。ログイン不要で、回答用のURLを配るだけで使えます。
          </p>
          <button className="primary" onClick={makeSurvey} disabled={surveyLoading}>
            {surveyLoading ? "作成中…（30秒ほどかかります）" : "このポスターからアンケートを作成"}
          </button>
          {surveyLoading && <p className="loading">AIが質問を考えています…</p>}
          {surveyError && <div className="error">{surveyError}</div>}
        </section>
      )}

      {survey && (
        <>
          {typeof survey.costYen === "number" && (
            <div className="cost" style={{ marginTop: "16px" }}>
              今回のAPIコスト目安: 約{survey.costYen}円
            </div>
          )}
          {survey.forms.map((form) => {
            const badge = form.kind === "registration" ? "📝 事前申込フォーム" : "📊 事後アンケート";
            const respondUrl = `${origin}/s/${form.id}`;
            const editUrl = `${origin}/s/${form.id}/edit`;
            const resultsUrl = `${origin}/s/${form.id}/results`;
            return (
              <section className="group" key={form.id}>
                <h2>{badge}</h2>
                <div className="form-preview">
                  <div className="form-title">{form.title}</div>
                  {form.description && <div className="form-desc">{form.description}</div>}
                  <ol className="q-list">
                    {form.questions.map((q, i) => (
                      <li key={i} className="q-item">
                        <span className="q-title">
                          {q.title}
                          {q.required && <span className="q-req">必須</span>}
                        </span>
                        <span className="q-type">{TYPE_LABEL[q.type]}</span>
                        {q.help && <div className="q-help">{q.help}</div>}
                        {q.options?.length > 0 && (
                          <ul className="q-options">
                            {q.options.map((o, j) => (
                              <li key={j}>・{o}</li>
                            ))}
                          </ul>
                        )}
                        {q.type === "scale" && (
                          <div className="q-help">
                            1〜{q.scaleMax || 5}の段階評価
                            {q.scaleLabels ? `（${q.scaleLabels[0]}〜${q.scaleLabels[1]}）` : ""}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="link-box">
                  <CopyLink label="✍️ 回答用リンク（中高生に配る・QR用）" url={respondUrl} />
                  <CopyLink label="🔧 編集用リンク（質問をいじる）" url={editUrl} />
                  <CopyLink label="📈 集計・結果を見る" url={resultsUrl} />
                </div>
                <QrBlock id={form.id} />
              </section>
            );
          })}
          <p className="rule-hint">
            リンクはこのアプリが動いている間だけ有効です。配布・回答収集まで本番運用するときは、公開（デプロイ）が必要です。
          </p>
        </>
      )}
    </main>
  );
}

function CopyLink({ label, url }) {
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
