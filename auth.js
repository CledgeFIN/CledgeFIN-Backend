const jwt = require('jsonwebtoken');
const Subscriber = require('../models/Subscriber');
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) token = req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Not authorised. Please log in.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const subscriber = await Subscriber.findById(decoded.id);
    if (!subscriber) return res.status(401).json({ success: false, message: 'Subscriber no longer exists.' });
    req.subscriber = subscriber;
    next();
  } catch (err) { return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' }); }
};
exports.adminOnly = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) return res.status(403).json({ success: false, message: 'Admin access required.' });
  next();
};
exports.generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
