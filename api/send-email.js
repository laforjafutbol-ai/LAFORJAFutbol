const https = require("https");

const RESEND_KEY = process.env.RESEND_API_KEY;
const FIREBASE_PROJECT = "laforja-4be1d";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FROM = "La Forja <laforjafutbol@laforjafutbol.com>";
const REPLY = "laforjafutbol@gmail.com";

const QUOTES = [
  "The best players in the world were once beginners who refused to quit. Every rep counts — show up ready to work.",
  "Talent gets you to the door. Work ethic gets you through it. See you on the field.",
  "Champions are built in the moments nobody is watching. Today is one of those moments.",
  "One session will not make you great. But skipping one might be the reason you are not. Let's get to work.",
  "The pitch doesn't care how you feel. It only cares what you do. Come ready to do the work.",
  "Every touch, every rep, every drill — it all adds up. Trust the process.",
  "The players who make it aren't the most talented. They're the ones who outwork everyone else.",
  "Your future self will thank you for showing up today. See you out there.",
  "Iron sharpens iron. Come ready to be pushed.",
  "Greatness is not given. It is forged. Welcome to La Forja.",
];

function sendEmail(to, subject, html) {
  const body = JSON.stringify({ from: FROM, reply_to: REPLY, to: [to], subject, html });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => resolve(d)); });
    req.on("error", reject); req.write(body); req.end();
  });
}

function makeHtml(name, dateLabel, time, sessionLabel) {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  return `<div style="font-family:Georgia,serif;background:#0a0a0a;color:#f0f0f0;padding:40px;max-width:560px;margin:0 auto;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:10px;letter-spacing:5px;color:#707070;text-transform:uppercase;">La Forja · Private Training</div>
      <div style="width:40px;height:2px;background:linear-gradient(90deg,#c9a84c,#cc2222);margin:10px auto;border-radius:1px;"></div>
    </div>
    <h1 style="text-align:center;font-size:26px;font-weight:normal;color:#c9a84c;margin-bottom:20px;">See You Today! ⚽</h1>
    <div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">
      <p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">${name}</strong>,<br/>Your La Forja session is <strong style="color:#c9a84c;">today</strong>. Come ready to work!</p>
      <div style="border-top:1px solid #222;padding-top:14px;">
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">Date</span><span style="font-size:13px;color:#c0c0c0;">${dateLabel}</span></div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">Time</span><span style="font-size:13px;color:#c0c0c0;">${time}</span></div>
        <div style="display:flex;justify-content:space-between;padding:7px 0;"><span style="font-size:12px;color:#666;">Session</span><span style="font-size:13px;color:#c0c0c0;">${sessionLabel}</span></div>
      </div>
    </div>
    <div style="background:#0a0a0a;border:1px solid #222222;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="font-size:10px;letter-spacing:3px;color:#7a6030;text-transform:uppercase;margin-bottom:14px;">What to Bring</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="font-size:12px;color:#888;padding:6px 0;width:50%;">💧 Water bottle</td><td style="font-size:12px;color:#888;padding:6px 0;">👟 Cleats or turf shoes</td></tr>
        <tr><td style="font-size:12px;color:#888;padding:6px 0;" colspan="2">🎽 Elastic band <span style="color:#555;font-size:11px;">(one will be provided if needed)</span></td></tr>
      </table>
      <div style="font-size:11px;color:#555;margin-top:12px;line-height:1.7;border-top:1px solid #1a1a1a;padding-top:12px;">Please arrive <strong style="color:#c0c0c0;">15 minutes early</strong> to warm up. Sessions start and end on time — late arrivals miss the warmup.</div>
      <div style="margin-top:14px;padding:14px 16px;background:#161410;border-left:3px solid #c9a84c;border-radius:4px;font-size:13px;color:#c9a84c;font-style:italic;line-height:1.7;">&ldquo;${quote}&rdquo;<div style="font-size:10px;color:#7a6030;margin-top:6px;letter-spacing:2px;text-transform:uppercase;font-style:normal;">— Coach Carlos</div></div>
    </div>
    <div style="background:#1a0808;border:1px solid #cc222233;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:11px;color:#cc2222;margin-bottom:6px;">📍 Training Location</div>
      <div style="font-size:14px;color:#f0f0f0;margin-bottom:2px;">Bayview Park</div>
      <div style="font-size:12px;color:#888;">James Island, SC</div>
      <div style="margin-top:8px;"><a href="https://maps.google.com/?q=Bayview+Park+James+Island+SC" style="font-size:11px;color:#cc2222;text-decoration:none;">📍 Get Directions →</a></div>
    </div>
    <div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:10px;letter-spacing:3px;color:#7a6030;text-transform:uppercase;margin-bottom:8px;">Need to Reschedule?</div>
      <div style="font-size:12px;color:#666666;line-height:1.8;">Log into your account at <a href="https://laforjafutbol.com" style="color:#c9a84c;text-decoration:none;">laforjafutbol.com</a>, go to <strong style="color:#c0c0c0;">My Account</strong>, and tap <strong style="color:#c0c0c0;">Reschedule</strong> next to your session. No approval needed.</div>
    </div>
    <div style="text-align:center;padding-top:16px;border-top:1px solid #1a1a1a;">
      <div style="font-size:11px;color:#444;">Questions?</div>
      <a href="mailto:laforjafutbol@gmail.com" style="color:#c9a84c;font-size:12px;text-decoration:none;">laforjafutbol@gmail.com</a>
      <div style="font-size:10px;color:#333;margin-top:10px;letter-spacing:2px;text-transform:uppercase;">La Forja · Where Champions Are Forged</div>
    </div>
  </div>`;
}

module.exports = async function handler(req, res) {
  // Allow manual trigger via POST, or automated cron via GET
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  try {
    // Query TODAY's sessions (cron runs at 8 AM Friday)
    const today = new Date();
    const todayKey = today.toISOString().split("T")[0];

    const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

    async function queryBookings(collectionId, dateKey) {
      const url = `${baseUrl}:runQuery?key=${FIREBASE_API_KEY}`;
      const body = JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                { fieldFilter: { field: { fieldPath: "dateKey" }, op: "EQUAL", value: { stringValue: dateKey } } },
                { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "confirmed" } } },
              ],
            },
          },
        },
      });
      return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const r = https.request({
          hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        }, (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e){ resolve([]); } }); });
        r.on("error", reject); r.write(body); r.end();
      });
    }

    function getStr(fields, key) { return fields?.[key]?.stringValue || ""; }

    let sent = 0;
    const errors = [];

    // Group bookings
    const bookingsResult = await queryBookings("bookings", todayKey);
    for (const item of (bookingsResult || [])) {
      const f = item?.document?.fields;
      if (!f) continue;
      const email = getStr(f, "email");
      const name  = getStr(f, "name");
      if (!email || !name) continue;
      try {
        await sendEmail(email, "⏰ Reminder — Your La Forja Session is Today!", makeHtml(
          name,
          getStr(f, "dateLabel"),
          getStr(f, "sessTime"),
          "🔥 The Furnace"
        ));
        sent++;
      } catch(e) { errors.push(`${name}: ${e.message}`); }
    }

    // 1-on-1 inquiries
    const inquiriesResult = await queryBookings("inquiries", todayKey);
    for (const item of (inquiriesResult || [])) {
      const f = item?.document?.fields;
      if (!f) continue;
      const email = getStr(f, "email");
      const name  = getStr(f, "name");
      if (!email || !name) continue;
      try {
        await sendEmail(email, "⏰ Reminder — Your La Forja Session is Today!", makeHtml(
          name,
          getStr(f, "dateLabel"),
          getStr(f, "slotTime") || getStr(f, "sessTime"),
          "⚒️ The Tempering"
        ));
        sent++;
      } catch(e) { errors.push(`${name}: ${e.message}`); }
    }

    console.log(`Reminders sent: ${sent} for ${todayKey}`);
    return res.status(200).json({ success: true, sent, date: todayKey, errors });

  } catch (err) {
    console.error("Reminder cron error:", err);
    return res.status(500).json({ error: err.message });
  }
};
