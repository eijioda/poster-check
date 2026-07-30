// mirai塾のGoogleスプレッドシートへ、アンケート情報を1行ずつ自動追記する。
// Apps Script の Web App（doPost）にPOSTするだけ。認証キー不要。
//
// 環境変数:
//   SHEETS_WEBHOOK_URL  … Apps Script Web App の /exec URL（未設定なら何もしない）
//   SHEETS_TOKEN        … 任意。設定すると payload に token を付け、スクリプト側で照合できる

const WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;
const TOKEN = process.env.SHEETS_TOKEN || "";

export function sheetsEnabled() {
  return Boolean(WEBHOOK_URL);
}

// rows: [{ 種別, ワークショップ名, 名前, 日付, 実施日付, 概要, 目的, 作成者名, 編集url, 集計url }, ...]
// 戻り値: 成功したら true、未設定や失敗なら false（アンケート生成自体は止めない）
export async function appendRows(rows) {
  if (!WEBHOOK_URL || !Array.isArray(rows) || rows.length === 0) return false;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: TOKEN, rows }),
      // Apps Scriptは302リダイレクトを挟むので追従させる
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}
