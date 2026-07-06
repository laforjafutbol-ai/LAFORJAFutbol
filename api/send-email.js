module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var body = req.body;
  var booking = body.booking;
  var type = body.type;
  if (!booking || !booking.email) return res.status(400).json({ error: "Missing data" });

  var RESEND_KEY = "re_f4W7jRdA_MLzowTmFhFyvEnNT32BjhXQX";
  var FROM = "La Forja <laforjafutbol@laforjafutbol.com>";
  var REPLY = "laforjafutbol@gmail.com";

  // ── CONTACT FORM — sends TO Carlos, not to the client ──
  if (type === "contact") {
    var contactHtml = '<div style="font-family:Georgia,serif;background:#0a0a0a;color:#f0f0f0;padding:40px;max-width:560px;margin:0 auto;border-radius:16px;">' +
      '<div style="text-align:center;margin-bottom:24px;"><div style="font-size:10px;letter-spacing:5px;color:#707070;text-transform:uppercase;margin-bottom:6px;">La Forja · Account Message</div><div style="width:40px;height:2px;background:linear-gradient(90deg,#c9a84c,#cc2222);margin:10px auto;border-radius:1px;"></div></div>' +
      '<h1 style="text-align:center;font-size:22px;font-weight:normal;color:#c9a84c;margin-bottom:20px;">New Message from a Client</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:20px;margin-bottom:20px;">' +
      '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">From</span><span style="font-size:13px;color:#c0c0c0;">' + (booking.name || "Account holder") + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">Email</span><span style="font-size:13px;color:#c0c0c0;">' + booking.email + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">Subject</span><span style="font-size:13px;color:#c0c0c0;">' + (booking.subject || "General Question") + '</span></div>' +
      '<div style="padding:14px 0 0;"><div style="font-size:11px;color:#7a6030;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Message</div><div style="font-size:13px;color:#e0e0e0;line-height:1.8;white-space:pre-wrap;">' + (booking.message || "") + '</div></div>' +
      '</div>' +
      '<div style="text-align:center;padding-top:12px;border-top:1px solid #1a1a1a;"><a href="mailto:' + booking.email + '" style="color:#c9a84c;font-size:12px;text-decoration:none;">Reply to ' + (booking.name || "this client") + ' →</a></div>' +
      '</div>';

    try {
      var https0 = require("https");
      var emailBody0 = JSON.stringify({ from: FROM, reply_to: booking.email, to: ["laforjafutbol@gmail.com"], subject: "📩 New Message: " + (booking.subject || "General Question"), html: contactHtml });
      await new Promise(function(resolve, reject) {
        var options0 = {
          hostname: "api.resend.com", path: "/emails", method: "POST",
          headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(emailBody0) },
        };
        var req0 = https0.request(options0, function(r) {
          var data = ""; r.on("data", function(c){ data += c; }); r.on("end", function(){ if (r.statusCode >= 400) reject(new Error(data)); else resolve(data); });
        });
        req0.on("error", reject); req0.write(emailBody0); req0.end();
      });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Resend error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  var policyBlock = '<div style="background:#111111;border:1px solid #222222;border-radius:12px;padding:16px 20px;margin-bottom:20px;"><div style="font-size:10px;letter-spacing:3px;color:#7a6030;text-transform:uppercase;margin-bottom:8px;">Need to Reschedule?</div><div style="font-size:12px;color:#666666;line-height:1.8;">No problem — email <a href=\"mailto:laforjafutbol@gmail.com\" style=\"color:#c9a84c;text-decoration:none;\">laforjafutbol@gmail.com</a> and Coach Carlos will work something out with you.</div></div>';

  var quotes = [
    "The best players in the world were once beginners who refused to quit. Every rep counts — show up ready to work.",
    "Talent gets you to the door. Work ethic gets you through it. See you on the field.",
    "Champions are built in the moments nobody is watching. Today is one of those moments.",
    "One session will not make you great. But skipping one might be the reason you are not. Lets get to work.",
    "The pitch doesn't care how you feel. It only cares what you do. Come ready to do the work.",
    "Every touch, every rep, every drill — it all adds up. Trust the process.",
    "The players who make it aren't the most talented. They're the ones who outwork everyone else.",
    "Your future self will thank you for showing up today. See you out there.",
    "Iron sharpens iron. Come ready to be pushed.",
    "Greatness is not given. It is forged. Welcome to La Forja.",
  ];
  var randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  var gearBlock = '<div style="background:#0a0a0a;border:1px solid #222222;border-radius:12px;padding:20px 20px;margin-bottom:20px;"><div style="font-size:10px;letter-spacing:3px;color:#7a6030;text-transform:uppercase;margin-bottom:14px;">What to Bring</div><table style="width:100%;border-collapse:collapse;"><tr><td style="font-size:12px;color:#888888;padding:5px 0;width:50%;">💧 Water</td><td style="font-size:12px;color:#888888;padding:5px 0;">👟 Cleats</td></tr><tr><td style="font-size:12px;color:#888888;padding:5px 0;" colspan="2">🎽 Elastic band <span style="color:#555555;font-size:11px;">(one will be provided)</span></td></tr></table><div style="font-size:11px;color:#555555;margin-top:12px;line-height:1.7;border-top:1px solid #1a1a1a;padding-top:12px;">Please arrive <strong style="color:#c0c0c0;">15 minutes early</strong> to warm up. Sessions start and end on time.</div><div style="margin-top:14px;padding:14px 16px;background:#161410;border-left:3px solid #c9a84c;border-radius:4px;font-size:13px;color:#c9a84c;font-style:italic;line-height:1.7;">&ldquo;' + randomQuote + '&rdquo;<div style="font-size:10px;color:#7a6030;margin-top:6px;letter-spacing:2px;text-transform:uppercase;font-style:normal;">— Coach Carlos</div></div></div>';

  var locName   = booking.location       || "Bayview Park";
  var locDetail = booking.locationDetail || "James Island Youth Soccer Club Fields · James Island, SC";
  var locMaps   = booking.locationMaps   || "https://maps.google.com/?q=Bayview+Park+James+Island+SC";

  var locationBlock = '<div style="background:#1a0808;border:1px solid #cc222233;border-radius:12px;padding:16px 20px;margin-bottom:20px;"><div style="font-size:11px;color:#cc2222;margin-bottom:6px;">📍 Training Location</div><div style="font-size:14px;color:#f0f0f0;margin-bottom:2px;">' + locName + '</div><div style="font-size:12px;color:#888;">' + locDetail + '</div><div style="margin-top:8px;"><a href=\"' + locMaps + '\" style=\"font-size:11px;color:#cc2222;text-decoration:none;\">📍 Get Directions →</a></div></div>';

  var footerBlock = '<div style="text-align:center;padding-top:16px;border-top:1px solid #1a1a1a;"><div style="font-size:11px;color:#444;">Questions?</div><a href="mailto:laforjafutbol@gmail.com" style="color:#c9a84c;font-size:12px;text-decoration:none;">laforjafutbol@gmail.com</a><div style="font-size:10px;color:#333;margin-top:10px;letter-spacing:2px;text-transform:uppercase;">La Forja · Where Champions Are Forged</div></div>';

  function wrap(content) {
    return '<div style="font-family:Georgia,serif;background:#0a0a0a;color:#f0f0f0;padding:40px;max-width:560px;margin:0 auto;border-radius:16px;"><div style="text-align:center;margin-bottom:28px;"><div style="font-size:10px;letter-spacing:5px;color:#707070;text-transform:uppercase;margin-bottom:6px;">La Forja · Private Training</div><div style="width:40px;height:2px;background:linear-gradient(90deg,#c9a84c,#cc2222);margin:10px auto;border-radius:1px;"></div></div>' + content + gearBlock + policyBlock + locationBlock + footerBlock + '</div>';
  }

  function row(label, value) {
    return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;"><span style="font-size:12px;color:#666;">' + label + '</span><span style="font-size:13px;color:#c0c0c0;">' + (value || "") + '</span></div>';
  }

  var venmoBtn = '<div style="background:#1a1000;border:1px solid #c9a84c44;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;"><div style="font-size:11px;color:#7a6030;margin-bottom:8px;letter-spacing:2px;text-transform:uppercase;">Complete Your Payment</div><div style="font-size:13px;color:#999;margin-bottom:14px;">Send <strong style="color:#f0f0f0;font-size:22px;">$' + booking.price + '</strong> to lock in your spot</div><a href="https://venmo.com/u/carlos-cepeda-41" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#7a6030);color:#0a0a0a;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">Pay on Venmo →</a><div style="font-size:11px;color:#444;margin-top:10px;">@carlos-cepeda-41 · Include your name in the note</div></div>';

  var subject, html;

  if (type === "group") {
    // Group booking confirmed — payment already sent
    subject = "✅ Your La Forja Session is Confirmed!";
    var rows = [
      row("Date", booking.dateLabel),
      row("Time", booking.sessTime),
      row("Age Group", booking.ageGroup),
      row("Skill Focus", (booking.skillIcon || "") + " " + (booking.skill || "")),
      row("Players", booking.count + " player" + (booking.count > 1 ? "s" : "")),
      row("Amount Paid", "$" + booking.total),
    ].join("");
    html = wrap(
      '<h1 style="text-align:center;font-size:28px;font-weight:normal;color:#c9a84c;letter-spacing:2px;margin-bottom:20px;">Booking Confirmed ✓</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">' + booking.name + '</strong>,<br/>Coach Carlos has confirmed your payment. You\'re locked in — see you on the field! ⚽</p>' +
      '<div style="border-top:1px solid #222;padding-top:14px;"><div style="font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:12px;">Session Details</div>' + rows + '</div></div>'
    );

  } else if (type === "1on1_booking") {
    // Step 1 — slot confirmed, now pay
    subject = "📅 Your La Forja Slot is Confirmed — Send Payment to Lock It In";
    html = wrap(
      '<h1 style="text-align:center;font-size:26px;font-weight:normal;color:#c9a84c;letter-spacing:2px;margin-bottom:20px;">Slot Confirmed ✓</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">' + booking.name + '</strong>,<br/>Coach Carlos has confirmed your slot! Send your payment on Venmo to fully lock it in.</p>' +
      '<div style="border-top:1px solid #222;padding-top:14px;"><div style="font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:12px;">Session Details</div>' +
      row("Scheduled Time", booking.scheduledTime) +
      row("Session Type", "1-on-1 Private Training") +
      row("Amount Due", "$" + booking.price) +
      '</div></div>' +
      venmoBtn
    );

  } else if (type === "1on1_paid") {
    // Step 2 — payment confirmed, fully set
    subject = "🏆 Payment Confirmed — You're All Set for Your La Forja Session!";
    html = wrap(
      '<h1 style="text-align:center;font-size:26px;font-weight:normal;color:#22c55e;letter-spacing:2px;margin-bottom:20px;">You\'re All Set! ✓</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">' + booking.name + '</strong>,<br/>Coach Carlos has confirmed your payment. Your 1-on-1 session is fully booked — see you on the field! ⚽</p>' +
      '<div style="border-top:1px solid #222;padding-top:14px;"><div style="font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:12px;">Session Details</div>' +
      row("Scheduled Time", booking.scheduledTime) +
      row("Session Type", "1-on-1 Private Training") +
      row("Amount Paid", "$" + booking.price) +
      '</div></div>'
    );

  } else if (type === "reminder_group") {
    subject = "⏰ Reminder — Your La Forja Session is Today!";
    var rows2 = [
      row("Date", booking.dateLabel),
      row("Time", booking.sessTime),
      row("Location", "Bayview Park · James Island Youth Soccer Club Fields"),
      row("Age Group", booking.ageGroup),
      row("Skill Focus", (booking.skillIcon||"") + " " + (booking.skill||"")),
    ].join("");
    html = wrap(
      '<h1 style="text-align:center;font-size:26px;font-weight:normal;color:#c9a84c;letter-spacing:2px;margin-bottom:20px;">See You Tonight! ⚽</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">' + booking.name + '</strong>,<br/>Just a reminder that your La Forja session is <strong style="color:#c9a84c;">today</strong>. See you tonight — come ready to work!</p>' +
      '<div style="border-top:1px solid #222;padding-top:14px;"><div style="font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:12px;">Session Details</div>' +
      rows2 + '</div></div>'
    );

  } else if (type === "reminder_1on1") {
    subject = "⏰ Reminder — Your La Forja 1-on-1 is Today!";
    html = wrap(
      '<h1 style="text-align:center;font-size:26px;font-weight:normal;color:#c9a84c;letter-spacing:2px;margin-bottom:20px;">See You Tonight! ⚽</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">' + booking.name + '</strong>,<br/>Your 1-on-1 session with Coach Carlos is <strong style="color:#c9a84c;">tomorrow</strong>. Come ready to work!</p>' +
      '<div style="border-top:1px solid #222;padding-top:14px;"><div style="font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:12px;">Session Details</div>' +
      row("Date", booking.dateLabel) +
      row("Time", booking.slotTime || booking.sessTime) +
      row("Location", "Bayview Park · James Island Youth Soccer Club Fields") +
      row("Position", booking.position) +
      '</div></div>'
    );

  } else if (type === "reminder_pending_group" || type === "reminder_pending_1on1") {
    // Reminder but payment not yet confirmed
    const is1on1 = type === "reminder_pending_1on1";
    subject = "⚠️ Reminder — Your La Forja Session is Today · Payment Required";
    html = wrap(
      '<h1 style="text-align:center;font-size:24px;font-weight:normal;color:#c9a84c;letter-spacing:2px;margin-bottom:20px;">See You Tonight! ⚽</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">' + booking.name + '</strong>,<br/>Your session is <strong style="color:#c9a84c;">tomorrow</strong> — but we have not received your payment yet. Please send it as soon as possible to confirm your spot.</p>' +
      '<div style="border-top:1px solid #222;padding-top:14px;">' +
      row("Date", booking.dateLabel) +
      row("Time", is1on1 ? (booking.slotTime||booking.sessTime) : booking.sessTime) +
      row("Amount Due", "$" + booking.total) +
      '</div></div>' +
      '<div style="background:#1a1000;border:1px solid #c9a84c44;border-radius:12px;padding:20px;margin-bottom:20px;text-align:center;">' +
      '<div style="font-size:11px;color:#7a6030;margin-bottom:8px;letter-spacing:2px;text-transform:uppercase;">⚠️ Payment Still Required</div>' +
      '<div style="font-size:13px;color:#999;margin-bottom:14px;">Send <strong style="color:#f0f0f0;font-size:20px;">$' + booking.total + '</strong> on Venmo to lock in your spot.</div>' +
      '<a href="https://venmo.com/u/carlos-cepeda-41" style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#7a6030);color:#0a0a0a;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">Pay on Venmo →</a>' +
      '<div style="font-size:11px;color:#444;margin-top:10px;">@carlos-cepeda-41 · Include your name in the note</div></div>'
    );

  } else if (type === "reschedule") {
    subject = "📅 Your La Forja Session Has Been Moved";
    html = wrap(
      '<h1 style="text-align:center;font-size:26px;font-weight:normal;color:#c9a84c;letter-spacing:2px;margin-bottom:20px;">Session Updated ✓</h1>' +
      '<div style="background:#141414;border:1px solid #222;border-radius:14px;padding:24px;margin-bottom:20px;">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#999;line-height:1.8;">Hi <strong style="color:#f0f0f0;">' + booking.name + '</strong>,<br/>Coach Carlos has moved your session to a new date and time. Here are your updated details:</p>' +
      '<div style="border-top:1px solid #222;padding-top:14px;"><div style="font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;margin-bottom:12px;">Updated Session Details</div>' +
      row("New Date", booking.dateLabel) +
      row("New Time", booking.sessTime) +
      row("Location", booking.locationDetail || "Bayview Park · James Island Youth Soccer Club Fields") +
      row("Session", (booking.skillIcon||"🔥") + " " + (booking.skill||"The Furnace")) +
      '</div></div>' +
      '<p style="font-size:12px;color:#555;text-align:center;">Questions? Reply to this email or reach out directly.</p>'
    );

  } else {
    return res.status(400).json({ error: "Unknown type" });
  }

  try {
    var https = require("https");
    var emailBody = JSON.stringify({ from: FROM, reply_to: REPLY, to: [booking.email], subject: subject, html: html });

    await new Promise(function(resolve, reject) {
      var options = {
        hostname: "api.resend.com",
        path: "/emails",
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_KEY,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(emailBody),
        },
      };
      var req2 = https.request(options, function(r) {
        var data = "";
        r.on("data", function(chunk) { data += chunk; });
        r.on("end", function() {
          if (r.statusCode >= 400) reject(new Error(data));
          else resolve(data);
        });
      });
      req2.on("error", reject);
      req2.write(emailBody);
      req2.end();
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Resend error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
