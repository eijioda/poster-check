// ポスターの添削（チェック）結果を保存し、読み取り専用の共有リンクで見せるためのストア。

import crypto from "crypto";
import { USE_REDIS, redis, fileWrite, fileRead } from "./kv";

function newId() {
  return crypto.randomBytes(9).toString("base64url");
}
function isValidId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(id);
}
function key(id) {
  return `poster:check:${id}`;
}

export async function createCheck(data) {
  const id = newId();
  const record = {
    id,
    fileName: typeof data?.fileName === "string" ? data.fileName : "",
    summary: typeof data?.summary === "string" ? data.summary : "",
    passed: Array.isArray(data?.passed) ? data.passed : [],
    findings: Array.isArray(data?.findings) ? data.findings : [],
    image: typeof data?.image === "string" ? data.image : null, // data:image/jpeg;base64,...
    createdAt: new Date().toISOString(),
  };
  if (USE_REDIS) {
    await redis(["SET", key(id), JSON.stringify(record)]);
  } else {
    await fileWrite("checks", id, record);
  }
  return record;
}

export async function getCheck(id) {
  if (!isValidId(id)) return null;
  if (USE_REDIS) {
    const raw = await redis(["GET", key(id)]);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return fileRead("checks", id);
}
