const Stripe = require("stripe");
const https = require("https");

const stripe = Stripe("sk_test_51TW0MzFU9deEKlhCQdCpU6zZeeSKKffjLFJVLKLcwaU9N0dNpwdfLk3e7OaglckppivQ3bsFgJ0kJGlLzQKBC45i00TPqsBM3S");

const FIREBASE_PROJECT = "laforja-4be1d";
const FIREBASE_API_KEY = "AIzaSyCpdHWgEPYWtLlJrVcAm-QMBguT9okjLvs";

// Helper to ADD a new Firestore document
function addFirestoreDoc(collectionName, fields) {
  return new Promise((resolve, reject) => {
    const fsFields = {};
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === "string") fsFields[key] = { stringValue: value };
      else if (typeof value === "number") fsFields[key] = { doubleValue: value };
      else if (typeof value === "boolean") fsFields[key] = { booleanValue: value };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${collectionName}?key=${FIREBASE_API_KEY}`;
    const body = JSON.stringify({ fields: fsFields });
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", (c) => (data += c));
      r.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Helper to PATCH a Firestore document via REST API
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
    const maskQuery = updateMask.join("&");
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${collectionName}/${docId}?${maskQuery}&key=${FIREBASE_API_KEY}`;
    const body = JSON.stringify({ fields: fsFields });
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(options, (r) => {
      let data = "";
      r.on("data", (c) => (data += c));
      r.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let event;
  try {
    // Note: signature verification requires the raw body + webhook secret from Stripe dashboard.
    // Once you set up the webhook in Stripe, add STRIPE_WEBHOOK_SECRET as an env var and verify here.
    event = req.body;
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const meta = intent.metadata || {};
    const { docId, collectionName } = meta;

    if (docId && collectionName) {
      try {
        await updateFirestoreDoc(collectionName, docId, {
          status: "confirmed",
          paymentMethod: "stripe",
          paymentIntentId: intent.id,
        });

        // Auto-log income to finance tracker
        const bookingData = JSON.parse(meta.bookingData || "{}");
        if (intent.amount > 0) {
          await addFirestoreDoc("finance_entries", {
            type: "income",
            date: bookingData.dateKey || new Date().toISOString().split("T")[0],
            category: collectionName === "inquiries" ? "1-on-1" : "Session — Single",
            description: `${bookingData.name || ""} · ${bookingData.dateLabel || ""}`.trim().replace(/^·\s*/,""),
            amount: intent.amount / 100,
            stripeBookingId: docId,
            stripePaymentId: intent.id,
            auto: true,
            createdAt: new Date().toISOString(),
          });
        }

        // Trigger confirmation email
        await fetch(`https://${req.headers.host}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking: JSON.parse(meta.bookingData || "{}"),
            type: collectionName === "inquiries" ? "1on1_booking" : "group",
          }),
        });
      } catch (err) {
        console.error("Webhook processing error:", err.message);
      }
    }
  }

  return res.status(200).json({ received: true });
};
