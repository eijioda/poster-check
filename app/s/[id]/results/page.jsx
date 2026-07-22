"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    setLoading(true);
    fetch(`/api/survey/${id}/results`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }

  function cell(a) {
    if (a === undefined || a === null) return "";
    if (Array.isArray(a)) return a.join(" / ");
    return String(a);
  }

  function downloadCsv() {
    const qs = data.questions;
    const header = ["回答日時", ...qs.map((q) => q.title)];
    const rows = data.responses.map((r) => [
      r.at,
      ...qs.map((_, i) => cell(r.answers[i])),
    ]);
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(esc).join(",")).join("\r\n");
    // Excelで文字化けしないようBOMを付ける
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.title}_回答.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (loading) return <main><p className="loading">読み込み中…</p></main>;
  if (error) return <main><div className="error">{error}</div></main>;

  const { questions, responses } = data;

  return (
    <main>
      <h1>集計結果</h1>
      <p className="subtitle">{data.title}</p>

      <div className="summary">
        回答数: <strong>{responses.length}</strong> 件
        <button className="secondary" onClick={load} style={{ marginLeft: "12px" }}>
          最新に更新
        </button>
      </div>

      {responses.length === 0 ? (
        <div className="summary" style={{ marginTop: "16px" }}>
          まだ回答がありません。回答用リンクを配ってみましょう。
        </div>
      ) : (
        <>
          <button className="secondary" onClick={downloadCsv} style={{ marginTop: "16px" }}>
            回答をCSVでダウンロード（Excelで開けます）
          </button>

          {questions.map((q, i) => (
            <section className="group" key={i}>
              <h2>Q{i + 1}. {q.title}</h2>
              <Aggregate q={q} answers={responses.map((r) => r.answers[i])} />
            </section>
          ))}
        </>
      )}
    </main>
  );
}

function Aggregate({ q, answers }) {
  // 選択式: 選択肢ごとの件数を棒で表示
  if (q.type === "choice" || q.type === "checkbox" || q.type === "scale") {
    let labels;
    if (q.type === "scale") {
      labels = Array.from({ length: q.scaleMax || 5 }, (_, k) => String(k + 1));
    } else {
      labels = q.options || [];
    }
    const counts = {};
    labels.forEach((l) => (counts[l] = 0));
    let total = 0;
    answers.forEach((a) => {
      const vals = Array.isArray(a) ? a : a === undefined || a === null || a === "" ? [] : [a];
      vals.forEach((v) => {
        const key = String(v);
        if (key in counts) counts[key]++;
        total++;
      });
    });
    const max = Math.max(1, ...labels.map((l) => counts[l]));
    return (
      <div className="agg">
        {labels.map((l) => (
          <div className="agg-row" key={l}>
            <span className="agg-label">{l}</span>
            <span className="agg-bar" style={{ width: `${(counts[l] / max) * 100}%` }} />
            <span className="agg-count">{counts[l]}</span>
          </div>
        ))}
      </div>
    );
  }

  // 記述式: 回答をそのまま一覧
  const texts = answers.filter((a) => typeof a === "string" && a.trim());
  if (texts.length === 0) return <div className="q-help">回答なし</div>;
  return (
    <ul className="text-answers">
      {texts.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}
