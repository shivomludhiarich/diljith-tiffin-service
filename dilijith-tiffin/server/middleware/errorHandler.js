export function errorHandler(err, req, res, next) {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  
  // Safe sanitized message without leaking stack traces or credentials
  let message = err.message || 'An internal server error occurred.';

  // Handle Mongoose duplicate key errors gracefully
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `A record with this ${field} already exists.`;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join('. ');
  }

  res.status(statusCode).json({
    ok: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { errorType: err.name }),
  });
}
