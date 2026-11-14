import jwt from 'jsonwebtoken';

export const auth = (...roles) => (req, res, next) => {
  const header = req.headers.authorization || '';
  try {
    req.user = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Please log in again' });
  }
  if (roles.length && !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have access to this page' });
  }
  next();
};
