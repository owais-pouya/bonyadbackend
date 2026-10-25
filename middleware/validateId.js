import { httpError } from "./errorHandler.js";

// Rejects /:id values that are not positive integers (avoids Postgres cast errors -> 500).
export function validateId(req, _res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return next(httpError(400, "Invalid id"));
  }
  req.params.id = id;
  next();
}
