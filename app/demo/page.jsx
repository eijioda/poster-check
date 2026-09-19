"use client";

// デモ版。サンプルのポスターとチェック結果があらかじめ入っていて、
// OpenAIのAPIキーが無くても「FB文を作るところ」まで一通り触れる。
//
// - チェックはAIを呼ばない（下のサンプル結果を使う）
// - FB文の作成は /api/feedback を実際に呼ぶ。APIキーがあればAIが、
//   無ければテンプレートが文章を組み立てる（「デモ（AI未使用）」と表示される）

import Link from "next/link";
import CheckResult from "../components/CheckResult";
import FeedbackComposer from "../components/FeedbackComposer";

const SAMPLE = {
  amigo: "さくら",
  projectName: "古着リメイク市",
  summary:
    "日時と会場は分かりやすく書けています。ただし終了時刻と駐車場の記載がなく、このままだと来場者が困ります。",
  passed: [
    "実施日時（日付・曜日）",
    "会場（住所を明記）",
    "主催: 南魚沼市",
    "参加費の有無",
  ],
  findings: [
    {
      severity: "error",
      title: "終了時刻が書かれていない",
      detail: "「10:00〜」とだけあり、何時に終わるか分かりません。",
      suggestion: "10:00〜12:00",
    },
    {
      severity: "error",
      title: "駐車場の場所がない",
      detail:
        "会場の住所はありますが、車で来る人がどこに停めればよいか分かりません。",
      suggestion: "駐車場: 旧五十沢中学校グラウンド",
    },
    {
      severity: "warning",
      title: "運営の表記が固定値と違う",
      detail: "「みらい塾」とありますが、正式には「(一社)愛 南魚沼みらい塾」です。",
      suggestion: "運営: (一社)愛 南魚沼みらい塾",
    },
    {
      severity: "warning",
      title: "持ち物が書かれていない",
      detail: "リメイクする古着を持参するのかどうかが読み取れません。",
      suggestion: "持ち物: リメイクしたい古着1〜2着（無くても参加できます）",
    },
    {
      severity: "suggestion",
      title: "企画名から内容が想像しにくい",
      detail:
        "「古着リメイク市」だと、自分で作る体験なのか、リメイク品を買えるお店なのか迷います。",
      suggestion: "古着リメイク市 〜自分だけの1着を作ろう〜",
    },
    {
      severity: "suggestion",
      title: "タイトルの改行位置",
      detail: "「古着リメ／イク市」と単語の途中で改行されていて読みにくいです。",
      suggestion: "",
    },
  ],
};

export default function DemoPage() {
  return (
    <main>
      <h1>ポスターチェックAI（デモ）</h1>
      <p className="subtitle">
        サンプルのポスターでチェック済みの状態です。下の「FB文を作る」だけ実際に動きます。{" "}
        <Link href="/">本物を使う →</Link>
      </p>

      <div className="demo-banner">
        このページはお試し用です。ポスターのアップロードとAIチェックは行いません。
        OpenAIのAPIキーが設定されていない環境では、FB文もAIを使わずテンプレートで作ります。
      </div>

      <SamplePoster />

      <CheckResult
        summary={SAMPLE.summary}
        passed={SAMPLE.passed}
        findings={SAMPLE.findings}
      />

      <FeedbackComposer
        findings={SAMPLE.findings}
        passed={SAMPLE.passed}
        summary={SAMPLE.summary}
        checkId={null}
        shareUrl=""
        defaultTo={SAMPLE.amigo}
        defaultProjectName={SAMPLE.projectName}
      />
    </main>
  );
}

// サンプルのポスター（画像ファイルを置かずに済むよう、その場で描いている）
function SamplePoster() {
  return (
    <svg className="preview demo-poster" viewBox="0 0 300 420" role="img" aria-label="サンプルポスター">
      <rect width="300" height="420" fill="#fffaf2" />
      <rect x="0" y="0" width="300" height="96" fill="#4f46e5" />
      <text x="150" y="42" textAnchor="middle" fill="#fff" fontSize="25" fontWeight="700">
        古着リメ
      </text>
      <text x="150" y="72" textAnchor="middle" fill="#fff" fontSize="25" fontWeight="700">
        イク市
      </text>
      <text x="150" y="140" textAnchor="middle" fill="#0f172a" fontSize="17" fontWeight="700">
        8月10日(土) 10:00〜
      </text>
      <text x="150" y="172" textAnchor="middle" fill="#334155" fontSize="13">
        会場: 南魚沼市六日町1-1
      </text>
      <text x="150" y="194" textAnchor="middle" fill="#334155" fontSize="13">
        参加費: 無料
      </text>
      <circle cx="150" cy="268" r="46" fill="#eef2ff" />
      <path d="M126 268 l16 -22 h16 l16 22 -10 30 h-28 z" fill="#4f46e5" opacity="0.65" />
      <text x="150" y="352" textAnchor="middle" fill="#64748b" fontSize="11">
        主催: 南魚沼市 ／ 運営: みらい塾
      </text>
      <text x="150" y="372" textAnchor="middle" fill="#64748b" fontSize="11">
        連絡先: youkey.mirai@gmail.com
      </text>
      <text x="150" y="400" textAnchor="middle" fill="#94a3b8" fontSize="10">
        （デモ用のサンプルです）
      </text>
    </svg>
  );
}
