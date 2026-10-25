import { pool, query } from "../config/db.js";
import { httpError } from "../middleware/errorHandler.js";

const DISCOUNT_THRESHOLD = 3500;
const DISCOUNT_RATE = 0.1;
const MAX_LINES = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/enquiries
// Body: { alias, email, notes, items: [{ materialId, quantity }, ...] }
export async function createEnquiry(req, res) {
  const { alias, email, notes, items } = req.body ?? {};

  // ---- 1) Field validation ----
  const fieldErrors = {};
  const cleanAlias = String(alias ?? "").trim();
  const cleanEmail = String(email ?? "").trim();
  const cleanNotes = String(notes ?? "").trim();

  if (!cleanAlias) fieldErrors.alias = "Enter a customer alias.";
  else if (cleanAlias.length > 120) fieldErrors.alias = "Alias is too long (max 120).";
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 200)
    fieldErrors.email = "Enter a valid email.";
  if (!cleanNotes) fieldErrors.notes = "Add delivery notes.";
  else if (cleanNotes.length > 2000) fieldErrors.notes = "Notes are too long (max 2000).";
  if (!Array.isArray(items) || items.length === 0) {
    fieldErrors.items = "Add at least one material.";
  } else if (items.length > MAX_LINES) {
    fieldErrors.items = `At most ${MAX_LINES} materials per enquiry.`;
  }
  if (Object.keys(fieldErrors).length) {
    throw httpError(400, "Validation failed", fieldErrors);
  }

  // ---- 2) Normalise items: whole-number ids, merge duplicates ----
  const wanted = new Map(); // materialId -> quantity
  const lineErrors = {};
  for (const item of items) {
    const id = Number(item?.materialId);
    const qty = Number(item?.quantity);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      lineErrors.items = "One of the materials is invalid.";
      continue;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      lineErrors[id] = "Quantity must be a whole number above 0.";
      continue;
    }
    wanted.set(id, (wanted.get(id) ?? 0) + qty);
  }

  // ---- 3) Load materials (single query for all ids) ----
  const { rows: materials } = wanted.size
    ? await query("SELECT * FROM materials WHERE id = ANY($1::int[])", [[...wanted.keys()]])
    : { rows: [] };
  const byId = new Map(materials.map((m) => [m.id, m]));

  // ---- 4) Validate each line against stock ----
  const lines = [];
  for (const [id, qty] of wanted) {
    if (lineErrors[id]) continue;
    const m = byId.get(id);
    if (!m) {
      lineErrors[id] = "Material not found (it may have been removed).";
      continue;
    }
    if (qty > m.available_quantity) {
      lineErrors[id] =
        `Only ${m.available_quantity} ${m.unit}(s) of ${m.name} available.`;
      continue;
    }
    lines.push({
      materialId: m.id,
      materialName: m.name,
      unit: m.unit,
      unitPriceAFN: m.unit_price_afn,
      quantity: qty,
      lineCostAFN: m.unit_price_afn * qty,
    });
  }

  if (Object.keys(lineErrors).length) {
    throw httpError(400, "Stock or quantity problem", lineErrors);
  }

  // ---- 5) Recompute totals server-side (never trust client) ----
  const subtotal = lines.reduce((s, l) => s + l.lineCostAFN, 0);
  const discount =
    subtotal >= DISCOUNT_THRESHOLD ? Math.round(subtotal * DISCOUNT_RATE) : 0;
  const finalEstimate = subtotal - discount;

  // ---- 6) Insert enquiry + lines in one transaction ----
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      rows: [enquiry],
    } = await client.query(
      `INSERT INTO enquiries (alias, email, notes, subtotal, discount, final_estimate)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [cleanAlias, cleanEmail, cleanNotes, subtotal, discount, finalEstimate],
    );

    for (const l of lines) {
      await client.query(
        `INSERT INTO enquiry_lines
           (enquiry_id, material_id, material_name, unit, unit_price_afn, quantity, line_cost_afn)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [enquiry.id, l.materialId, l.materialName, l.unit, l.unitPriceAFN, l.quantity, l.lineCostAFN],
      );
    }
    await client.query("COMMIT");

    res.status(201).json({
      id: enquiry.id,
      createdAt: enquiry.created_at,
      alias: cleanAlias,
      email: cleanEmail,
      notes: cleanNotes,
      subtotal,
      discount,
      finalEstimate,
      lines,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/enquiries  (admin) - newest first, each with its lines
export async function listEnquiries(_req, res) {
  const { rows } = await query(
    `SELECT e.id, e.alias, e.email, e.notes, e.subtotal, e.discount,
            e.final_estimate, e.created_at,
            COALESCE(
              json_agg(
                json_build_object(
                  'materialId',   l.material_id,
                  'materialName', l.material_name,
                  'unit',         l.unit,
                  'unitPriceAFN', l.unit_price_afn,
                  'quantity',     l.quantity,
                  'lineCostAFN',  l.line_cost_afn
                ) ORDER BY l.id
              ) FILTER (WHERE l.id IS NOT NULL),
              '[]'::json
            ) AS lines
       FROM enquiries e
       LEFT JOIN enquiry_lines l ON l.enquiry_id = e.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT 200`,
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      alias: r.alias,
      email: r.email,
      notes: r.notes,
      subtotal: r.subtotal,
      discount: r.discount,
      finalEstimate: r.final_estimate,
      createdAt: r.created_at,
      lines: r.lines,
    })),
  );
}

// DELETE /api/enquiries/:id  (admin)
export async function deleteEnquiry(req, res) {
  const { rowCount } = await query("DELETE FROM enquiries WHERE id = $1", [
    req.params.id,
  ]);
  if (!rowCount) throw httpError(404, "Enquiry not found");
  res.status(204).end();
}
