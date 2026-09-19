"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CheckResult from "../../components/CheckResult";

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

      <CheckResult
        summary={data.summary}
        passed={data.passed || []}
        findings={findings}
      />
    </main>
  );
}
