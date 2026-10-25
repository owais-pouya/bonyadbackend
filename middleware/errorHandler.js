// Central error handler. Controllers call next(err) and land here.
export function errorHandler(err, _req, res, _next) {
  // Bad JSON body from express.json()
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }

  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error(err);

  // Never leak database / internal messages to the browser.
  const body = { error: status >= 500 ? "Server error" : err.message };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
}

// Wrap async controllers so rejects hit errorHandler instead of hanging.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Small helper: build an error with a status (and optional field details).
export function httpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}
