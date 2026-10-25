import { query } from "../config/db.js";
import { httpError } from "../middleware/errorHandler.js";

// DB row (snake_case) -> API object (camelCase, matches React).
const toApi = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  unit: row.unit,
  unitPriceAFN: row.unit_price_afn,
  availableQuantity: row.available_quantity,
  description: row.description,
});

const first = (v) => (Array.isArray(v) ? v[0] : v);

// GET /api/materials?category=&search=&sort=low|high&available=true
export async function listMaterials(req, res) {
  const category = first(req.query.category);
  const search = first(req.query.search);
  const sort = first(req.query.sort);
  const available = first(req.query.available);
  const where = [];
  const params = [];

  if (category && category !== "all") {
    params.push(String(category));
    where.push(`category = $${params.length}`);
  }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    where.push(`lower(name) LIKE $${params.length}`);
  }
  if (available === "true") {
    where.push("available_quantity > 0");
  }

  let order = "id ASC";
  if (sort === "low") order = "unit_price_afn ASC, id ASC";
  if (sort === "high") order = "unit_price_afn DESC, id ASC";

  const sql = `
    SELECT * FROM materials
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY ${order}
  `;
  const { rows } = await query(sql, params);
  res.json(rows.map(toApi));
}

// GET /api/materials/:id
export async function getMaterial(req, res) {
  const { rows } = await query("SELECT * FROM materials WHERE id = $1", [
    req.params.id,
  ]);
  if (!rows.length) throw httpError(404, "Material not found");
  res.json(toApi(rows[0]));
}

// POST /api/materials
export async function createMaterial(req, res) {
  const m = req.material; // set by validateMaterial
  const { rows } = await query(
    `INSERT INTO materials (name, category, unit, unit_price_afn, available_quantity, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [m.name, m.category, m.unit, m.unitPriceAFN, m.availableQuantity, m.description],
  );
  res.status(201).json(toApi(rows[0]));
}

// PUT /api/materials/:id
export async function updateMaterial(req, res) {
  const m = req.material;
  const { rows } = await query(
    `UPDATE materials
        SET name = $1, category = $2, unit = $3,
            unit_price_afn = $4, available_quantity = $5, description = $6
      WHERE id = $7
      RETURNING *`,
    [m.name, m.category, m.unit, m.unitPriceAFN, m.availableQuantity, m.description, req.params.id],
  );
  if (!rows.length) throw httpError(404, "Material not found");
  res.json(toApi(rows[0]));
}

// DELETE /api/materials/:id
export async function deleteMaterial(req, res) {
  const { rowCount } = await query("DELETE FROM materials WHERE id = $1", [
    req.params.id,
  ]);
  if (!rowCount) throw httpError(404, "Material not found");
  res.status(204).end();
}
