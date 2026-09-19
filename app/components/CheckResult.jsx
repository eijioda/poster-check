"use client";

// ポスターのチェック結果（総評・確認できた項目・指摘）の表示。
// トップ画面 / 共有ページ / デモページ で共通に使う。

export const SEVERITY_LABEL = {
  error: "❌ 必須項目欠落",
  warning: "⚠️ 要確認",
  suggestion: "💡 改善提案",
};

const SEV_ICON = { error: "❌", warning: "⚠️", suggestion: "💡" };
const ORDER = ["error", "warning", "suggestion"];

export default function CheckResult({ summary, passed = [], findings = [], children }) {
  const counts = ORDER.map((sev) => findings.filter((f) => f.severity === sev).length);

  return (
    <>
      {findings.length > 0 && (
        <div className="sev-badges">
          {ORDER.map((sev, i) =>
            counts[i] > 0 ? (
              <span className={`sev-badge sev-${sev}`} key={sev}>
                {SEV_ICON[sev]} {counts[i]}
              </span>
            ) : null
          )}
        </div>
      )}

      {summary && (
        <div className="summary">
          <strong>総評:</strong> {summary}
          {children}
        </div>
      )}

      {passed.length > 0 && (
        <section className="group">
          <h2>✅ 確認できた項目（{passed.length}件）</h2>
          <div className="passed">
            {passed.map((p, i) => (
              <span className="passed-item" key={i}>
                ✓ {p}
              </span>
            ))}
          </div>
        </section>
      )}

      {ORDER.map((sev) => {
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
    </>
  );
}
