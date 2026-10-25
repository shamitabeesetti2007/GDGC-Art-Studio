function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err.message);
  
  // Never expose stack traces or internal details
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.'
    }
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.'
    }
  });
}

module.exports = { errorHandler, notFoundHandler };
