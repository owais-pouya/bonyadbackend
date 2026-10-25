import { pool } from "../config/db.js";

const DISCOUNT_THRESHOLD = 3500;
const DISCOUNT_RATE = 0.1;

// POST /api/enquiries
// Body: { alias, email, notes, items: [{ materialId, quantity }, ...] }
export async function createEnquiry(req, res, next) {
  const { alias, email, notes = "", items } = req.body ?? {};

  // ---- 1) Field validation ----
  const fieldErrors = {};
  if (!alias || !String(alias).trim())
    fieldErrors.alias = "Enter a customer alias.";
  if (!email || !String(email).includes("@") || !String(email).includes(".")) {
    fieldErrors.email = "Enter a valid email.";
  }
  if (!notes || !String(notes).trim())
    fieldErrors.notes = "Add delivery notes.";
  if (!Array.isArray(items) || items.length === 0) {
    fieldErrors.items = "Add at least one material.";
  }
  if (Object.keys(fieldErrors).length) {
    const err = new Error("Validation failed");
    err.status = 400;
    err.details = fieldErrors;
    throw err;
  }

  // ---- 2) Load materials (single query for all ids) ----
  const ids = items.map((i) => Number(i.materialId));
  const { rows: materials } = await pool.query(
    "SELECT * FROM materials WHERE id = ANY($1::int[])",
    [ids],
  );
  const byId = new Map(materials.map((m) => [m.id, m]));

  // ---- 3) Validate each line against stock ----
  const lineErrors = {};
  const lines = [];
  for (const item of items) {
    const m = byId.get(Number(item.materialId));
    const qty = Number(item.quantity);

    if (!m) {
      lineErrors[item.materialId] = "Material not found.";
      continue;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      lineErrors[m.id] = "Quantity must be a whole number above 0.";
      continue;
    }
    if (qty > m.available_quantity) {
      lineErrors[m.id] =
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
    const err = new Error("Stock or quantity problem");
    err.status = 400;
    err.details = lineErrors;
    throw err;
  }

  // ---- 4) Recompute totals server-side (never trust client) ----
  const subtotal = lines.reduce((s, l) => s + l.lineCostAFN, 0);
  const discount =
    subtotal >= DISCOUNT_THRESHOLD ? Math.round(subtotal * DISCOUNT_RATE) : 0;
  const finalEstimate = subtotal - discount;

  // ---- 5) Insert enquiry + lines in one transaction ----
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      rows: [enquiry],
    } = await client.query(
      `INSERT INTO enquiries (alias, email, notes, subtotal, discount, final_estimate)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        String(alias).trim(),
        String(email).trim(),
        String(notes).trim(),
        subtotal,
        discount,
        finalEstimate,
      ],
    );

    for (const l of lines) {
      await client.query(
        `INSERT INTO enquiry_lines
           (enquiry_id, material_id, material_name, unit, unit_price_afn, quantity, line_cost_afn)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          enquiry.id,
          l.materialId,
          l.materialName,
          l.unit,
          l.unitPriceAFN,
          l.quantity,
          l.lineCostAFN,
        ],
      );
    }
    await client.query("COMMIT");

    res.status(201).json({
      id: enquiry.id,
      createdAt: enquiry.created_at,
      alias,
      email,
      notes,
      subtotal,
      discount,
      finalEstimate,
      lines,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}
