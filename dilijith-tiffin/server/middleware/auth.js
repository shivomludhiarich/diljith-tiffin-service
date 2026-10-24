import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { readSessionCookie } from './sessionCookie.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[Auth] JWT_SECRET is not defined. Set it in your .env file before starting the server.');
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function protect(req, res, next) {
  try {
    const token = readSessionCookie(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        message: 'Authentication required. No token provided.',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || (decoded.tokenVersion || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        ok: false,
        message: 'Account no longer exists.',
      });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({
        ok: false,
        message: 'Account is inactive or suspended.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: 'Invalid or expired authentication token.',
    });
  }
}

export function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      ok: false,
      message: 'Access denied: Administrator privileges required.',
    });
  }
  next();
}
