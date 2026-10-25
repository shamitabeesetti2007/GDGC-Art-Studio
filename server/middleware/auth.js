const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before the server starts.');
}

function authRequired(req, res, next) {
  const token = req.cookies && req.cookies.jwt;
  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'You must be logged in to access this resource.'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Your session has expired. Please log in again.'
      }
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.'
        }
      });
    }
    next();
  };
}

function requireCustomer(req, res, next) {
  if (req.user.role !== 'customer') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Only customers can perform this action.'
      }
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Only studio administrators can perform this action.'
      }
    });
  }
  next();
}

module.exports = { authRequired, requireRole, requireCustomer, requireAdmin };
