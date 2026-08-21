const Stripe = require("stripe");
const https = require("https");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const FIREBASE_PROJECT = "laforja-4be1d";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;

// Update a Firestore doc
function updateFirestoreDoc(collectionName, docId, fields) {
  return new Promise((resolve, reject) => {
    const fsFields = {};
    const updateMask = [];
    for (const [key, value] of Object.entries(fields)) {
      updateMask.push(`updateMask.fieldPaths=${key}`);
      if (typeof value === "string") fsFields[key] = { stringValue: value };
      else if (typeof value === "number") fsFields[key] = { doubleValue: value };
      else if (typeof value === "boolean") fsFields[key] = { booleanValue: value };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${collectionName}/${docId}?${updateMask.join("&")}&key=${FIREBASE_API_KEY}`;
    const body = JSON.stringify({ fields: fsFields });
    const urlObj = new URL(url);
    const req = https.request({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: "PATCH", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => resolve(d)); });
    req.on("error", reject); req.write(body); req.end();
  });
}

// Query Firestore for bookings by bookingRef
function queryFirestore(collectionId, bookingRef) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: { fieldFilter: { field: { fieldPath: "id" }, op: "EQUAL", value: { stringValue: bookingRef } } },
        limit: 10,
      }
    });
    const urlObj = new URL(url);
    const req = https.request({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try{ resolve(JSON.parse(d)); }catch(e){ resolve([]); } }); });
    req.on("error", reject); req.write(body); req.end();
  });
}

// Send email via Resend
function sendConfirmationEmail(booking) {
  return new Promise((resolve) => {
    if (!booking.email || !RESEND_KEY) return resolve();
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://laforjafutbol.com";
    const body = JSON.stringify({ booking, type: "group" });
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => { console.log("Email sent:", d); resolve(); }); });
    req.on("error", (e) => { console.error("Email error:", e); resolve(); });

    // Actually call our own send-email endpoint
    const emailPayload = JSON.stringify({ booking: { ...booking, paymentMethod: "card" }, type: "group" });
    const emailReq = https.request({
      hostname: "laforjafutbol.com", path: "/api/send-email", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(emailPayload) }
    }, (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => { console.log("Confirmation email response:", d); resolve(); }); });
    emailReq.on("error", (e) => { console.error("Email send error:", e); resolve(); });
    emailReq.write(emailPayload);
    emailReq.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let event;
  try {
    event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (err) {
    return res.status(400).send("Invalid payload");
  }

  console.log("Webhook event:", event.type);

  // Handle Stripe Checkout completion
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session.metadata || {};
    const bookingRef = meta.bookingRef;
    const total = parseFloat(meta.total || "0");
    const customerEmail = session.customer_details?.email || session.customer_email || "";

    console.log("Checkout completed, bookingRef:", bookingRef, "email:", customerEmail);

    if (bookingRef) {
      try {
        // Update the booking status to confirmed and mark as card payment
        await updateFirestoreDoc("bookings", bookingRef, {
          status: "confirmed",
          paymentMethod: "card",
          stripeSessionId: session.id,
          paidAt: new Date().toISOString(),
        });
        console.log("Booking confirmed:", bookingRef);

        // Build booking data for email from metadata
        const bookingForEmail = {
          name: customerEmail, // will be overridden if we find the booking
          email: customerEmail,
          dateLabel: "",
          sessTime: "",
          skill: "The Furnace",
          skillIcon: "🔥",
          count: parseInt(meta.players || "1"),
          total,
          paymentMethod: "card",
          packageName: meta.packageName || "Session",
        };

        // Send confirmation email
        await sendConfirmationEmail(bookingForEmail);

      } catch (err) {
        console.error("Webhook processing error:", err.message);
      }
    }
  }

  return res.status(200).json({ received: true });
};
