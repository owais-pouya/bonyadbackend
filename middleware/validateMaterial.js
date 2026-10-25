// Validation for POST / PUT /api/materials.
// Mirrors the frontend MaterialForm + the DB CHECK constraints.
import { httpError } from "./errorHandler.js";

const CATEGORIES = ["cement", "aggregates", "fittings"];
const UNITS = ["bag", "load", "piece"];
const MAX_INT = 2147483647;

export function validateMaterial(req, _res, next) {
  const {
    name,
    category,
    unit,
    unitPriceAFN,
    availableQuantity,
    description = "",
  } = req.body ?? {};
  const errors = {};

  if (!name || !String(name).trim()) errors.name = "Enter a material name.";
  else if (String(name).trim().length > 120) errors.name = "Name is too long (max 120).";
  if (!CATEGORIES.includes(category))
    errors.category = "Category must be cement, aggregates or fittings.";
  if (!UNITS.includes(unit)) errors.unit = "Unit must be bag, load or piece.";

  // Price column is INTEGER, so only whole AFN amounts are accepted.
  const price = Number(unitPriceAFN);
  if (!Number.isInteger(price) || price <= 0 || price > MAX_INT)
    errors.unitPriceAFN = "Price must be a whole number above 0.";

  const stock = Number(availableQuantity);
  if (
    availableQuantity === "" ||
    availableQuantity === null ||
    availableQuantity === undefined ||
    !Number.isInteger(stock) ||
    stock < 0 ||
    stock > MAX_INT
  )
    errors.availableQuantity = "Stock must be a whole number, 0 or more.";

  if (String(description ?? "").length > 1000)
    errors.description = "Description is too long (max 1000).";

  if (Object.keys(errors).length) {
    return next(httpError(400, "Validation failed", errors));
  }

  req.material = {
    name: String(name).trim(),
    category,
    unit,
    unitPriceAFN: price,
    availableQuantity: stock,
    description: String(description ?? "").trim(),
  };
  next();
}
