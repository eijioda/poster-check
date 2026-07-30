"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const SEVERITY_LABEL = {
  error: "❌ 必須項目欠落",
  warning: "⚠️ 要確認",
  suggestion: "💡 改善提案",
};

export default function SharedCheckPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/check/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main><p className="loading">読み込み中…</p></main>;
  if (error) return <main><div className="error">{error}</div></main>;

  const findings = data.findings || [];

  return (
    <main>
      <h1>ポスター添削結果（共有）</h1>
      <p className="subtitle">
        この結果は読み取り専用です。 <Link href="/">新しくチェックする →</Link>
      </p>

      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="preview shared-poster" src={data.image} alt="ポスター" />
      )}

      {data.summary && (
        <div className="summary">
          <strong>総評:</strong> {data.summary}
        </div>
      )}

      {data.passed?.length > 0 && (
        <section className="group">
          <h2>✅ 確認できた項目（{data.passed.length}件）</h2>
          <div className="passed">
            {data.passed.map((p, i) => (
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
            <h2>{SEVERITY_LABEL[sev]}（{items.length}件）</h2>
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
    </main>
  );
}
