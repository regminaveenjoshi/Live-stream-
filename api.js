// Netlify Function: /api
// GET  -> public data (stream, matches, telegram link). Secrets kabhi nahi jaate.
// POST -> admin only (password check server pe hota hai): {pass, action: "load" | "save", data}

const crypto = require("crypto");

const BIN_URL = "https://api.jsonbin.io/v3/b/" + process.env.JSONBIN_BIN_ID;
const HEADERS = {
  "Content-Type": "application/json",
  "X-Master-Key": process.env.JSONBIN_KEY || "",
};

const CACHE_MS = 15000; // public data 15 sec cache (JSONBin requests bachane ke liye)
let cache = { at: 0, data: null };

function reply(status, body, extra) {
  return {
    statusCode: status,
    headers: Object.assign({ "Content-Type": "application/json" }, extra || {}),
    body: JSON.stringify(body),
  };
}

// Sirf allowed cheezein rakhta hai, purana admin_pass bhi yahin hat jata hai
function cleanData(d) {
  const out = d && typeof d === "object" ? d : {};
  return {
    stream: out.stream || { stream_url: null, is_live: false, current_match: null },
    matches: Array.isArray(out.matches) ? out.matches : [],
    settings: {
      telegram_link: (out.settings && out.settings.telegram_link) || "https://t.me/",
    },
  };
}

async function readBin() {
  const res = await fetch(BIN_URL + "/latest", { headers: HEADERS });
  if (!res.ok) throw new Error("JSONBin read failed: " + res.status);
  const j = await res.json();
  return cleanData(j.record);
}

async function writeBin(data) {
  const res = await fetch(BIN_URL, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("JSONBin write failed: " + res.status);
}

function passOk(given) {
  const real = process.env.ADMIN_PASS || "";
  if (!real || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(real);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  try {
    if (!process.env.JSONBIN_BIN_ID || !process.env.JSONBIN_KEY || !process.env.ADMIN_PASS) {
      console.error("Missing env vars: JSONBIN_BIN_ID / JSONBIN_KEY / ADMIN_PASS");
      return reply(500, { error: "server not configured" });
    }

    if (event.httpMethod === "GET") {
      const now = Date.now();
      if (!cache.data || now - cache.at > CACHE_MS) {
        cache = { at: now, data: await readBin() };
      }
      return reply(200, cache.data, { "Cache-Control": "public, max-age=10" });
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return reply(400, { error: "bad request" });
      }

      if (!passOk(body.pass)) {
        await new Promise((r) => setTimeout(r, 800)); // brute-force slow
        return reply(401, { error: "wrong password" });
      }

      if (body.action === "load") {
        return reply(200, await readBin(), { "Cache-Control": "no-store" });
      }

      if (body.action === "save") {
        const clean = cleanData(body.data);
        await writeBin(clean);
        cache = { at: Date.now(), data: clean };
        return reply(200, { ok: true }, { "Cache-Control": "no-store" });
      }

      return reply(400, { error: "unknown action" });
    }

    return reply(405, { error: "method not allowed" });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "server error" });
  }
};
