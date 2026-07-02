const https = require("https");

const RESEND_KEY = "re_f4W7jRdA_MLzowTmFhFyvEnNT32BjhXQX";
const FIREBASE_PROJECT = "laforja-4be1d";
const FIREBASE_API_KEY = "AIzaSyCpdHWgEPYWtLlJrVcAm-QMBguT9okjLvs";
const FROM = "La Forja <laforjafutbol@laforjafutbol.com>";
const REPLY = "laforjafutbol@gmail.com";

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let data = "";
      r.on("data", c => data += c);
      r.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

async function sendEmail(to, subject, html) {
  const body = JSON.stringify({ from: FROM, reply_to: REPLY, to: [to], subject, html });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(options, (r) => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => resolve(d));
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

function makeHtml(name, dateLabel, time, extra) {
  return `<div style="font-family:Georgia,serif;background:#0a0a0a;color:#f0f0f0;padding:40px;max-width:560px;margin:0 auto;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;"><div style="font-size:10px;letter-spacing:5px;color:#707070;text-transform:uppercase;">La Forja · Private Training</div><div style="width:40px;height:2px;background:linear-gradient(90deg,#c9a84c,#cc2222);margin:10px auto;border-radius:1px;"></div></div>
    <h1 style="text-align:center;font-size:26px;font-weight:normal;color:#c9a84c;margin-bottom:20px;">See You Tomorrow! ⚽</h1>
    <div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">
      <p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">${name}</strong>,<br/>Your La Forja session is <strong style="color:#c9a84c;">tomorrow</strong>. Come ready to work!</p>
      <div style="border-top:1px solid #222;padding-top:14px;">
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">Date</span><span style="font-size:13px;color:#c0c0c0;">${dateLabel}</span></div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">Time</span><span style="font-size:13px;color:#c0c0c0;">${time}</span></div>
        ${extra}
      </div>
    </div>
    <div style="background:#0a0a0a;border:1px solid #222;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:10px;letter-spacing:3px;color:#7a6030;text-transform:uppercase;margin-bottom:12px;">What to Bring</div>
      <table style="width:100%;border-collapse:collapse;"><tr><td style="font-size:12px;color:#888;padding:5px 0;width:50%;">💧 Water</td><td style="font-size:12px;color:#888;padding:5px 0;">👟 Cleats</td></tr><tr><td style="font-size:12px;color:#888;padding:5px 0;" colspan="2">🎽 Elastic band (one will be provided)</td></tr></table>
      <div style="font-size:11px;color:#555;margin-top:10px;border-top:1px solid #1a1a1a;padding-top:10px;">Please arrive <strong style="color:#c0c0c0;">15 minutes early</strong>. Sessions start and end on time.</div>
    </div>
    <div style="background:#1a0808;border:1px solid #cc222233;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:11px;color:#cc2222;margin-bottom:6px;">📍 Training Location</div>
      <div style="font-size:14px;color:#f0f0f0;margin-bottom:2px;">Bayview Park</div>
      <div style="font-size:12px;color:#888;">James Island Youth Soccer Club Fields · James Island, SC</div>
    </div>
    <div style="text-align:center;padding-top:16px;border-top:1px solid #1a1a1a;">
      <div style="font-size:11px;color:#444;">Questions?</div>
      <a href="mailto:laforjafutbol@gmail.com" style="color:#c9a84c;font-size:12px;text-decoration:none;">laforjafutbol@gmail.com</a>
      <div style="font-size:10px;color:#333;margin-top:10px;letter-spacing:2px;text-transform:uppercase;">La Forja · Where Champions Are Forged</div>
    </div>
  </div>`;
}

module.exports = async function handler(req, res) {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tk = tomorrow.toISOString().split("T")[0];

    // Query Firestore REST API — no admin SDK needed
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

    async function queryCollection(collectionId, field, value) {
      const url = `${baseUrl}:runQuery?key=${FIREBASE_API_KEY}`;
      const body = JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } },
                { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "confirmed" } } },
              ],
            },
          },
        },
      });
      return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        };
        const r = https.request(options, (res) => {
          let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e){ resolve([]); } });
        });
        r.on("error", reject); r.write(body); r.end();
      });
    }

    function getStr(fields, key) { return fields?.[key]?.stringValue || ""; }

    let sent = 0;

    // Group bookings
    const bookingsResult = await queryCollection("bookings", "dateKey", tk);
    for (const item of (bookingsResult || [])) {
      const f = item?.document?.fields;
      if (!f) continue;
      const email = getStr(f, "email");
      const name = getStr(f, "name");
      if (!email || !name) continue;
      const extra = `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">Age Group</span><span style="font-size:13px;color:#c0c0c0;">${getStr(f,"ageGroup")}</span></div><div style="display:flex;justify-content:space-between;padding:7px 0;"><span style="font-size:12px;color:#666;">Focus</span><span style="font-size:13px;color:#c0c0c0;">${getStr(f,"skillIcon")} ${getStr(f,"skill")}</span></div>`;
      await sendEmail(email, "⏰ Reminder — Your La Forja Session is Tomorrow!", makeHtml(name, getStr(f,"dateLabel"), getStr(f,"sessTime"), extra));
      sent++;
    }

    // 1-on-1 inquiries
    const inquiriesResult = await queryCollection("inquiries", "dateKey", tk);
    for (const item of (inquiriesResult || [])) {
      const f = item?.document?.fields;
      if (!f) continue;
      const email = getStr(f, "email");
      const name = getStr(f, "name");
      if (!email || !name) continue;
      const extra = `<div style="display:flex;justify-content:space-between;padding:7px 0;"><span style="font-size:12px;color:#666;">Position</span><span style="font-size:13px;color:#c9a84c;">${getStr(f,"position")}</span></div>`;
      await sendEmail(email, "⏰ Reminder — Your La Forja 1-on-1 is Tomorrow!", makeHtml(name, getStr(f,"dateLabel"), getStr(f,"slotTime")||getStr(f,"sessTime"), extra));
      sent++;
    }

    return res.status(200).json({ success: true, sent, date: tk });
  } catch (err) {
    console.error("Cron error:", err);
    return res.status(500).json({ error: err.message });
  }
};
