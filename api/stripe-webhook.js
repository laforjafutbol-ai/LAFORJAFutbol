const Stripe = require("stripe");
const https  = require("https");

const stripe           = Stripe(process.env.STRIPE_SECRET_KEY);
const FIREBASE_PROJECT = "laforja-4be1d";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const WEBHOOK_SECRET   = process.env.STRIPE_WEBHOOK_SECRET; // set in Vercel env vars

// ── Firestore helpers ─────────────────────────────────────

// Update a single doc by its Firestore document ID
function updateFirestoreDoc(collectionName, docId, fields) {
  return new Promise((resolve, reject) => {
    const fsFields  = {};
    const maskParts = [];
    for (const [key, value] of Object.entries(fields)) {
      maskParts.push(`updateMask.fieldPaths=${encodeURIComponent(key)}`);
      if (typeof value === "string")  fsFields[key] = { stringValue: value };
      else if (typeof value === "number")  fsFields[key] = { doubleValue: value };
      else if (typeof value === "boolean") fsFields[key] = { booleanValue: value };
    }
    const url    = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${collectionName}/${docId}?${maskParts.join("&")}&key=${FIREBASE_API_KEY}`;
    const body   = JSON.stringify({ fields: fsFields });
    const urlObj = new URL(url);
    const req = https.request(
      { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: "PATCH",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => resolve(d)); }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Query Firestore for all bookings matching a packageGroupId field
function queryByPackageGroup(packageGroupId) {
  return new Promise((resolve, reject) => {
    const url  = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "bookings" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "packageGroupId" },
            op: "EQUAL",
            value: { stringValue: packageGroupId },
          },
        },
        limit: 20,
      },
    });
    const urlObj = new URL(url);
    const req = https.request(
      { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (r) => {
        let d = "";
        r.on("data", c => d += c);
        r.on("end", () => {
          try {
            const parsed = JSON.parse(d);
            // Each result has a .document.name like …/bookings/<docId>
            const docs = parsed
              .filter(item => item.document)
              .map(item => ({
                id: item.document.name.split("/").pop(),
                ...Object.fromEntries(
                  Object.entries(item.document.fields || {}).map(([k, v]) => [
                    k,
                    v.stringValue ?? v.doubleValue ?? v.booleanValue ?? v.integerValue ?? null,
                  ])
                ),
              }));
            resolve(docs);
          } catch (e) {
            resolve([]);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Send confirmation email via our own API
function sendConfirmationEmail(booking) {
  return new Promise((resolve) => {
    if (!booking.email) return resolve();
    const payload = JSON.stringify({ booking: { ...booking, paymentMethod: "card" }, type: "group" });
    const req = https.request(
      { hostname: "laforjafutbol.com", path: "/api/send-email", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (r) => { let d = ""; r.on("data", c => d += c); r.on("end", () => { console.log("Email sent:", r.statusCode); resolve(); }); }
    );
    req.on("error", (e) => { console.error("Email error:", e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

// ── Handler ───────────────────────────────────────────────
async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Collect raw body buffer (Vercel streams it when bodyParser is off)
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

  let event;

  if (WEBHOOK_SECRET) {
    const sig = req.headers["stripe-signature"];
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // No webhook secret set — skip signature check (dev/staging only)
    try {
      event = JSON.parse(rawBody.toString());
    } catch (err) {
      return res.status(400).send("Invalid payload");
    }
  }

  console.log("Webhook event:", event.type);

  if (event.type === "checkout.session.completed") {
    const session       = event.data.object;
    const meta          = session.metadata || {};
    const bookingRef    = meta.bookingRef    || "";   // first/single booking doc ID
    const packageGroupId = meta.packageGroupId || ""; // shared ID across all package bookings
    const total         = parseFloat(meta.total || "0");
    const customerEmail = session.customer_details?.email || session.customer_email || "";

    console.log("Checkout completed | bookingRef:", bookingRef, "| packageGroupId:", packageGroupId, "| email:", customerEmail);

    const confirmedAt = new Date().toISOString();
    const updateFields = {
      status: "confirmed",
      paymentMethod: "card",
      stripeSessionId: session.id,
      paidAt: confirmedAt,
    };

    try {
      if (packageGroupId) {
        // ── Package: confirm ALL bookings that share this packageGroupId ──
        const docs = await queryByPackageGroup(packageGroupId);
        console.log(`Found ${docs.length} bookings for packageGroupId ${packageGroupId}`);
        await Promise.all(docs.map(d => updateFirestoreDoc("bookings", d.id, updateFields)));

        if (customerEmail || docs[0]?.email) {
          const emailBooking = {
            ...docs[0],
            email: customerEmail || docs[0]?.email,
            total,
            packageBooking: true,
            packageName: meta.packageName || "Package",
            packageDates: docs.map(d => d.dateLabel || "").filter(Boolean).join(", "),
            count: parseInt(meta.players || "1"),
          };
          await sendConfirmationEmail(emailBooking);
        }
      } else if (bookingRef) {
        // ── Single session: confirm by doc ID ──
        await updateFirestoreDoc("bookings", bookingRef, updateFields);
        console.log("Single booking confirmed:", bookingRef);

        const emailBooking = {
          email: customerEmail,
          total,
          skill: "The Furnace",
          skillIcon: "🔥",
          count: parseInt(meta.players || "1"),
          packageName: meta.packageName || "Single Session",
        };
        await sendConfirmationEmail(emailBooking);
      } else {
        console.warn("No bookingRef or packageGroupId in metadata — nothing to confirm");
      }
    } catch (err) {
      console.error("Webhook processing error:", err.message);
    }
  }

  return res.status(200).json({ received: true });
}

// Vercel: disable body parsing so Stripe gets raw bytes for signature verification
handler.config = { api: { bodyParser: false } };

module.exports = handler;
