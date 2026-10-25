// Central error handler. Controllers call next(err) and land here.
export function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status ?? 500;
  const body = { error: err.message ?? "Server error" };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
}

// Wrap async controllers so rejects hit errorHandler instead of hanging.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
