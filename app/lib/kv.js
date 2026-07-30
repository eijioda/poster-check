// 保存の低レベル共通処理。
// - 本番(Vercel等): Upstash Redis（環境変数があれば自動でこちら）
// - ローカル: data/ 以下のJSONファイル
//
// 文字列(SET/GET)とリスト(RPUSH/LRANGE)の両方を、両バックエンドで扱えるようにする。

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const USE_REDIS = Boolean(REST_URL && REST_TOKEN);

export function storageMode() {
  return USE_REDIS ? "redis" : "file";
}

// ---- Upstash Redis REST（依存パッケージなし） ----
export async function redis(command) {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redisエラー (${res.status})`);
  const data = await res.json();
  return data.result;
}

// ---- ファイル保存（ローカル用） ----
function fileFor(dir, id) {
  return path.join(process.cwd(), "data", dir, `${id}.json`);
}

export async function fileWrite(dir, id, obj) {
  await mkdir(path.join(process.cwd(), "data", dir), { recursive: true });
  await writeFile(fileFor(dir, id), JSON.stringify(obj, null, 2), "utf-8");
}

export async function fileRead(dir, id) {
  try {
    return JSON.parse(await readFile(fileFor(dir, id), "utf-8"));
  } catch {
    return null;
  }
}
