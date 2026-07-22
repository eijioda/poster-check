// アンケートの保存ストア。
// - ローカル開発: data/surveys/ にJSONファイル保存
// - 本番(Vercel等): Upstash Redis（環境変数があれば自動でこちらに切り替わる）
//
// 回答(responses)はアンケート定義とは別に持ち、同時に複数の回答が来ても
// 取りこぼさないようにしている（Redisではリスト、ファイルでも追記）。

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { normalizeQuestions } from "./survey";

// ---- バックエンド判定 ----
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = Boolean(REST_URL && REST_TOKEN);

const DIR = path.join(process.cwd(), "data", "surveys");

function fileFor(id) {
  return path.join(DIR, `${id}.json`);
}
function defKey(id) {
  return `poster:survey:${id}`;
}
function respKey(id) {
  return `poster:survey:${id}:responses`;
}

function newId() {
  return crypto.randomBytes(9).toString("base64url");
}
function isValidId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(id);
}

// ---- Upstash Redis REST クライアント（依存パッケージなし） ----
async function redis(command) {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Redisエラー (${res.status})`);
  }
  const data = await res.json();
  return data.result;
}

// ---- 定義部分 ----

function makeRecord(data) {
  return {
    id: data.id,
    title:
      typeof data?.title === "string" && data.title.trim() ? data.title.trim() : "アンケート",
    description: typeof data?.description === "string" ? data.description.trim() : "",
    questions: normalizeQuestions(data?.questions),
    createdAt: data.createdAt || new Date().toISOString(),
  };
}

export async function createSurvey(data) {
  const id = newId();
  const record = makeRecord({ ...data, id });
  if (USE_REDIS) {
    await redis(["SET", defKey(id), JSON.stringify(record)]);
  } else {
    await mkdir(DIR, { recursive: true });
    await writeFile(fileFor(id), JSON.stringify({ ...record, responses: [] }, null, 2), "utf-8");
  }
  return record;
}

export async function getSurvey(id) {
  if (!isValidId(id)) return null;
  if (USE_REDIS) {
    const raw = await redis(["GET", defKey(id)]);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  try {
    const obj = JSON.parse(await readFile(fileFor(id), "utf-8"));
    // ファイル版はresponsesを含むので定義だけ返す
    const { responses, ...def } = obj;
    return def;
  } catch {
    return null;
  }
}

export async function updateSurvey(id, patch) {
  const cur = await getSurvey(id);
  if (!cur) return null;
  const next = makeRecord({
    ...cur,
    title: typeof patch?.title === "string" && patch.title.trim() ? patch.title : cur.title,
    description: typeof patch?.description === "string" ? patch.description : cur.description,
    questions: Array.isArray(patch?.questions) ? patch.questions : cur.questions,
    createdAt: cur.createdAt,
    id,
  });
  if (USE_REDIS) {
    await redis(["SET", defKey(id), JSON.stringify(next)]);
  } else {
    const responses = await getResponses(id);
    await writeFile(fileFor(id), JSON.stringify({ ...next, responses }, null, 2), "utf-8");
  }
  return next;
}

// ---- 回答部分 ----

export async function addResponse(id, answers) {
  const def = await getSurvey(id);
  if (!def) return null;
  const entry = { at: new Date().toISOString(), answers: answers || {} };
  if (USE_REDIS) {
    await redis(["RPUSH", respKey(id), JSON.stringify(entry)]);
  } else {
    let obj;
    try {
      obj = JSON.parse(await readFile(fileFor(id), "utf-8"));
    } catch {
      obj = { ...def, responses: [] };
    }
    if (!Array.isArray(obj.responses)) obj.responses = [];
    obj.responses.push(entry);
    await writeFile(fileFor(id), JSON.stringify(obj, null, 2), "utf-8");
  }
  return true;
}

export async function getResponses(id) {
  if (!isValidId(id)) return [];
  if (USE_REDIS) {
    const list = await redis(["LRANGE", respKey(id), "0", "-1"]);
    if (!Array.isArray(list)) return [];
    return list
      .map((s) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
  try {
    const obj = JSON.parse(await readFile(fileFor(id), "utf-8"));
    return Array.isArray(obj.responses) ? obj.responses : [];
  } catch {
    return [];
  }
}

export function storageMode() {
  return USE_REDIS ? "redis" : "file";
}
