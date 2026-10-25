// Validation for POST / PUT /api/materials.
// Mirrors the frontend MaterialForm + the DB CHECK constraints.
const CATEGORIES = ["cement", "aggregates", "fittings"];
const UNITS = ["bag", "load", "piece"];

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
  if (!CATEGORIES.includes(category))
    errors.category = "Category must be cement, aggregates or fittings.";
  if (!UNITS.includes(unit)) errors.unit = "Unit must be bag, load or piece.";

  const price = Number(unitPriceAFN);
  if (!Number.isFinite(price) || price <= 0)
    errors.unitPriceAFN = "Price must be more than 0.";

  const stock = Number(availableQuantity);
  if (!Number.isInteger(stock) || stock < 0)
    errors.availableQuantity = "Stock must be a whole number, 0 or more.";

  if (Object.keys(errors).length) {
    const err = new Error("Validation failed");
    err.status = 400;
    err.details = errors;
    return next(err);
  }

  req.material = {
    name: String(name).trim(),
    category,
    unit,
    unitPriceAFN: price,
    availableQuantity: stock,
    description: String(description).trim(),
  };
  next();
}
