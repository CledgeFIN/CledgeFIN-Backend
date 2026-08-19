// ═══════════════════════════════════════════════════════
//  CledgeFIN Backend — Single File Bundle
//  by BusinessPulse Technologies Limited
// ═══════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();

// ── CORS ──
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      'https://businesspulse-ng.netlify.app',
      'https://cledgefin-app.netlify.app',
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500'
    ];
    if (!origin || allowed.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ── Body Parsers ──
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB Connect ──
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ════════════════════════════════════════
// MODELS
// ════════════════════════════════════════

// Subscriber Model
const SubscriberSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  password: { type: String, required: true, minlength: 6, select: false },
  plan: { type: String, enum: ['Starter','Growth','Enterprise'], default: 'Starter' },
  planStatus: { type: String, enum: ['trial','active','expired','cancelled'], default: 'trial' },
  trialStartDate: { type: Date, default: Date.now },
  trialEndDate: { type: Date, default: () => new Date(Date.now() + 30*24*60*60*1000) },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  nextBillingDate: Date,
  paystackCustomerCode: String,
  lastPaymentDate: Date,
  lastPaymentAmount: Number,
  lastPaymentReference: String,
  totalPayments: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  payments: [{ reference: String, amount: Number, plan: String, date: { type: Date, default: Date.now }, status: { type: String, default: 'success' } }],
  accessCode: String,
  accessCodeGeneratedAt: Date,
  downloadCount: { type: Number, default: 0 },
  lastDownloadDate: Date,
  isActive: { type: Boolean, default: true },
  passwordResetToken: String,
  passwordResetExpires: Date,
  businessCategory: { type: String, default: 'trading' },
  notes: String
}, { timestamps: true });

SubscriberSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
SubscriberSchema.methods.comparePassword = async function(pwd) {
  return await bcrypt.compare(pwd, this.password);
};
SubscriberSchema.methods.isTrialActive = function() {
  return this.planStatus === 'trial' && new Date() < this.trialEndDate;
};
SubscriberSchema.methods.isSubscriptionActive = function() {
  return this.planStatus === 'active' && this.subscriptionEndDate && new Date() < this.subscriptionEndDate;
};
SubscriberSchema.methods.canAccessApp = function() {
  return this.isTrialActive() || this.isSubscriptionActive();
};
SubscriberSchema.methods.generateAccessCode = function() {
  const str = this.businessName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  let code = Math.abs(hash).toString(36).toUpperCase().slice(0, 6);
  while (code.length < 6) code = '0' + code;
  return 'BP-' + code;
};
const Subscriber = mongoose.model('Subscriber', SubscriberSchema);

// Contact Model
const Contact = mongoose.model('Contact', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String, subject: String,
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, { timestamps: true }));

// Waitlist Model
const Waitlist = mongoose.model('Waitlist', new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  name: String, phone: String, businessType: String
}, { timestamps: true }));

// ════════════════════════════════════════
// EMAIL
// ════════════════════════════════════════
const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    await transporter.sendMail({
      from: `"CledgeFIN by BusinessPulse Technologies Limited" <${process.env.GMAIL_USER}>`,
      to, subject, html
    });
    console.log('Email sent to:', to);
    return { success: true };
  } catch (err) {
    console.error('Email error:', err.message);
    return { success: false };
  }
};

const emailWrap = (title, body) => `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;background:#f0f3f8;margin:0;padding:20px}
.wrap{max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden}
.hdr{background:#1B2A4A;padding:24px;text-align:center}
.hdr h1{color:#B8860B;margin:0;font-size:22px}
.hdr p{color:rgba(255,255,255,.6);font-size:11px;margin:4px 0 0}
.body{padding:28px}.body h2{color:#1B2A4A}
.body p{color:#374151;font-size:14px;line-height:1.7}
.card{background:#f8f9fc;border-radius:8px;padding:14px 18px;margin:14px 0;border-left:4px solid #B8860B}
.card p{margin:4px 0;font-size:13px;color:#1B2A4A}
.btn{display:inline-block;background:#1D9E75;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;margin:14px 0}
.ftr{background:#f8f9fc;padding:16px;text-align:center;border-top:1px solid #e3e8f0}
.ftr p{color:#94a3b8;font-size:11px;margin:3px 0}</style></head>
<body><div class="wrap"><div class="hdr"><h1>CledgeFIN</h1>
<p>by BusinessPulse Technologies Limited</p></div>
<div class="body">${body}</div>
<div class="ftr"><p>Smart Financial Management for Growing African Businesses</p>
<p>© ${new Date().getFullYear()} BusinessPulse Technologies Limited</p></div>
</div></body></html>`;

// ════════════════════════════════════════
// MIDDLEWARE
// ════════════════════════════════════════
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ success: false, message: 'Not authorised.' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const subscriber = await Subscriber.findById(decoded.id);
    if (!subscriber) return res.status(401).json({ success: false, message: 'Subscriber not found.' });
    req.subscriber = subscriber;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const adminOnly = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

// ════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════
const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { businessName, ownerName, email, phone, password, plan, businessCategory } = req.body;
    if (!businessName || !ownerName || !email || !phone || !password)
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    const existing = await Subscriber.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered.' });
    const subscriber = await Subscriber.create({
      businessName: businessName.trim(), ownerName: ownerName.trim(),
      email: email.toLowerCase().trim(), phone: phone.trim(), password,
      plan: plan || 'Starter', businessCategory: businessCategory || 'trading',
      planStatus: 'trial', trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 30*24*60*60*1000)
    });
    subscriber.accessCode = subscriber.generateAccessCode();
    subscriber.accessCodeGeneratedAt = new Date();
    await subscriber.save();
    const dlToken = jwt.sign({ subscriberId: subscriber._id, type: 'download' }, process.env.DOWNLOAD_TOKEN_SECRET, { expiresIn: '7d' });
    const dlLink = `${process.env.APP_URL}/download/${dlToken}`;
    await sendEmail({ to: subscriber.email, subject: 'Welcome to CledgeFIN! Your app is ready',
      html: emailWrap('Welcome', `<h2>Welcome, ${subscriber.ownerName}!</h2>
      <p>Your CledgeFIN account is ready. Download your app using the button below.</p>
      <div class="card"><p><strong>Business:</strong> ${subscriber.businessName}</p>
      <p><strong>Plan:</strong> ${subscriber.plan}</p>
      <p><strong>Access Code:</strong> ${subscriber.accessCode}</p></div>
      <a href="${dlLink}" class="btn">⬇️ Download CledgeFIN App</a>
      <p style="font-size:11px;color:#94a3b8">Link expires in 7 days.</p>`) });
    await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[CledgeFIN] New Registration — ${subscriber.businessName}`,
      html: emailWrap('New Registration', `<h2>New Subscriber</h2>
      <div class="card"><p><strong>Business:</strong> ${subscriber.businessName}</p>
      <p><strong>Owner:</strong> ${subscriber.ownerName}</p>
      <p><strong>Email:</strong> ${subscriber.email}</p>
      <p><strong>Phone:</strong> ${subscriber.phone}</p>
      <p><strong>Plan:</strong> ${subscriber.plan}</p></div>`) });
    const token = generateToken(subscriber._id);
    res.status(201).json({ success: true, message: 'Account created. Check your email for download link.', token,
      subscriber: { id: subscriber._id, businessName: subscriber.businessName, email: subscriber.email, plan: subscriber.plan, accessCode: subscriber.accessCode } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
    const subscriber = await Subscriber.findOne({ email: email.toLowerCase() }).select('+password');
    if (!subscriber || !(await subscriber.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = generateToken(subscriber._id);
    res.json({ success: true, token, subscriber: {
      id: subscriber._id, businessName: subscriber.businessName, email: subscriber.email,
      plan: subscriber.plan, planStatus: subscriber.planStatus,
      trialEndDate: subscriber.trialEndDate, subscriptionEndDate: subscriber.subscriptionEndDate,
      accessCode: subscriber.accessCode, canAccess: subscriber.canAccessApp() } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

authRouter.get('/me', protect, async (req, res) => {
  try {
    const s = await Subscriber.findById(req.subscriber._id);
    res.json({ success: true, subscriber: {
      id: s._id, businessName: s.businessName, ownerName: s.ownerName,
      email: s.email, phone: s.phone, plan: s.plan, planStatus: s.planStatus,
      trialEndDate: s.trialEndDate, subscriptionEndDate: s.subscriptionEndDate,
      accessCode: s.accessCode, canAccess: s.canAccessApp(), downloadCount: s.downloadCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch profile.' });
  }
});

authRouter.get('/download-link', protect, async (req, res) => {
  try {
    const s = req.subscriber;
    if (!s.canAccessApp()) return res.status(403).json({ success: false, message: 'Subscription expired.' });
    const dlToken = jwt.sign({ subscriberId: s._id, type: 'download' }, process.env.DOWNLOAD_TOKEN_SECRET, { expiresIn: '24h' });
    res.json({ success: true, downloadLink: `${process.env.APP_URL}/download/${dlToken}`, expiresIn: '24 hours' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not generate link.' });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const subscriber = await Subscriber.findOne({ email: (req.body.email||'').toLowerCase() });
    if (!subscriber) return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    const resetToken = crypto.randomBytes(32).toString('hex');
    subscriber.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    subscriber.passwordResetExpires = new Date(Date.now() + 10*60*1000);
    await subscriber.save();
    const resetLink = `${process.env.APP_URL}/reset-password/${resetToken}`;
    await sendEmail({ to: subscriber.email, subject: 'CledgeFIN Password Reset',
      html: emailWrap('Password Reset', `<h2>Reset Your Password</h2>
      <p>Click the link below to reset your password. It expires in 10 minutes.</p>
      <a href="${resetLink}" class="btn">Reset Password</a>`) });
    res.json({ success: true, message: 'Password reset link sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send reset email.' });
  }
});

authRouter.post('/reset-password/:token', async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const subscriber = await Subscriber.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } });
    if (!subscriber) return res.status(400).json({ success: false, message: 'Token invalid or expired.' });
    subscriber.password = req.body.password;
    subscriber.passwordResetToken = undefined;
    subscriber.passwordResetExpires = undefined;
    await subscriber.save();
    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
});

// ════════════════════════════════════════
// PAYMENT ROUTES
// ════════════════════════════════════════
const paymentRouter = express.Router();
const PLAN_PRICES = {
  Starter:    { amount: 500000,  name: 'CledgeFIN Starter Plan' },
  Growth:     { amount: 1000000, name: 'CledgeFIN Growth Plan' },
  Enterprise: { amount: 1500000, name: 'CledgeFIN Enterprise Plan' }
};

paymentRouter.post('/initialize', protect, async (req, res) => {
  try {
    const { plan } = req.body;
    const s = req.subscriber;
    if (!PLAN_PRICES[plan]) return res.status(400).json({ success: false, message: 'Invalid plan.' });
    const reference = `CF-${s._id}-${Date.now()}`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: s.email, amount: PLAN_PRICES[plan].amount, reference, currency: 'NGN',
        metadata: { subscriberId: s._id.toString(), businessName: s.businessName, plan },
        callback_url: `${process.env.APP_URL}/payment/callback` })
    });
    const data = await response.json();
    if (!data.status) return res.status(400).json({ success: false, message: 'Payment init failed.' });
    res.json({ success: true, authorizationUrl: data.data.authorization_url, reference: data.data.reference });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Payment initialization failed.' });
  }
});

paymentRouter.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(req.body).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.status(401).json({ message: 'Invalid signature.' });
    const event = JSON.parse(req.body);
    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data;
      const { subscriberId, plan } = metadata;
      const subscriber = await Subscriber.findById(subscriberId);
      if (!subscriber) return res.sendStatus(200);
      const now = new Date();
      const endDate = new Date(now.getTime() + 30*24*60*60*1000);
      subscriber.plan = plan; subscriber.planStatus = 'active';
      subscriber.subscriptionStartDate = now; subscriber.subscriptionEndDate = endDate;
      subscriber.lastPaymentDate = now; subscriber.lastPaymentAmount = amount/100;
      subscriber.lastPaymentReference = reference;
      subscriber.totalPayments += 1; subscriber.totalRevenue += amount/100;
      subscriber.accessCode = subscriber.generateAccessCode();
      subscriber.accessCodeGeneratedAt = now;
      subscriber.payments.push({ reference, amount: amount/100, plan, date: now, status: 'success' });
      await subscriber.save();
      await sendEmail({ to: subscriber.email, subject: `Payment Confirmed — CledgeFIN ${plan} Plan`,
        html: emailWrap('Payment Confirmed', `<h2>Payment Received ✅</h2>
        <p>Dear ${subscriber.ownerName}, your payment has been confirmed.</p>
        <div class="card"><p><strong>Business:</strong> ${subscriber.businessName}</p>
        <p><strong>Plan:</strong> ${plan}</p>
        <p><strong>Amount:</strong> ₦${(amount/100).toLocaleString()}</p>
        <p><strong>Valid Until:</strong> ${endDate.toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}</p>
        <p><strong>Access Code:</strong> <span style="font-size:18px;font-weight:800;color:#B8860B;letter-spacing:3px">${subscriber.accessCode}</span></p></div>
        <p>Enter this access code in the app to activate your subscription.</p>`) });
      await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[CledgeFIN] Payment — ₦${(amount/100).toLocaleString()} — ${subscriber.businessName}`,
        html: emailWrap('Payment Received', `<h2>New Payment</h2>
        <div class="card"><p><strong>Business:</strong> ${subscriber.businessName}</p>
        <p><strong>Plan:</strong> ${plan}</p><p><strong>Amount:</strong> ₦${(amount/100).toLocaleString()}</p>
        <p><strong>Reference:</strong> ${reference}</p></div>`) });
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200);
  }
});

paymentRouter.get('/verify/:reference', protect, async (req, res) => {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${req.params.reference}`,
      { headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    const data = await response.json();
    const s = await Subscriber.findById(req.subscriber._id);
    res.json({ success: true, paid: data.data.status === 'success', plan: s.plan, planStatus: s.planStatus,
      subscriptionEndDate: s.subscriptionEndDate, accessCode: s.accessCode });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

paymentRouter.get('/history', protect, async (req, res) => {
  try {
    const s = await Subscriber.findById(req.subscriber._id);
    res.json({ success: true, payments: s.payments, totalPayments: s.totalPayments, totalRevenue: s.totalRevenue });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not fetch history.' });
  }
});

// ════════════════════════════════════════
// CONTACT ROUTES
// ════════════════════════════════════════
const contactRouter = express.Router();

contactRouter.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ success: false, message: 'Name, email and message required.' });
    await Contact.create({ name, email, phone, subject, message });
    await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[CledgeFIN] Message from ${name}`,
      html: emailWrap('Contact Form', `<h2>New Message</h2>
      <div class="card"><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone||'N/A'}</p><p><strong>Subject:</strong> ${subject||'N/A'}</p></div>
      <p><strong>Message:</strong></p><p style="background:#f8f9fc;padding:14px;border-radius:8px;border-left:4px solid #1D9E75">${message}</p>`) });
    await sendEmail({ to: email, subject: 'We received your message — CledgeFIN',
      html: emailWrap('Message Received', `<h2>Thank you, ${name}!</h2>
      <p>We received your message and will reply within 24 hours (Mon–Fri, 8am–6pm Nigerian time).</p>
      <a href="https://wa.me/2348034041321" class="btn">💬 Chat on WhatsApp</a>`) });
    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

contactRouter.post('/waitlist', async (req, res) => {
  try {
    const { email, name, phone, businessType } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
    const existing = await Waitlist.findOne({ email: email.toLowerCase() });
    if (existing) return res.json({ success: true, message: 'You are already on our waitlist.' });
    await Waitlist.create({ email, name, phone, businessType });
    await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[CledgeFIN] Waitlist — ${email}`,
      html: emailWrap('New Waitlist', `<h2>New Waitlist Signup</h2>
      <div class="card"><p><strong>Email:</strong> ${email}</p>
      <p><strong>Name:</strong> ${name||'N/A'}</p><p><strong>Phone:</strong> ${phone||'N/A'}</p></div>`) });
    res.json({ success: true, message: 'Added to waitlist successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to join waitlist.' });
  }
});

// ════════════════════════════════════════
// ADMIN ROUTES
// ════════════════════════════════════════
const adminRouter = express.Router();

adminRouter.get('/dashboard', adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const total = await Subscriber.countDocuments();
    const trial = await Subscriber.countDocuments({ planStatus: 'trial' });
    const active = await Subscriber.countDocuments({ planStatus: 'active' });
    const expired = await Subscriber.countDocuments({ planStatus: 'expired' });
    const rev = await Subscriber.aggregate([{ $group: { _id: null, total: { $sum: '$totalRevenue' }, payments: { $sum: '$totalPayments' } } }]);
    const plans = await Subscriber.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]);
    const recent = await Subscriber.find().sort({ createdAt: -1 }).limit(10).select('businessName ownerName email plan planStatus createdAt totalRevenue');
    const threeDays = new Date(now.getTime() + 3*24*60*60*1000);
    const expiring = await Subscriber.find({ planStatus: 'trial', trialEndDate: { $lte: threeDays, $gte: now } }).select('businessName email phone trialEndDate');
    const unread = await Contact.countDocuments({ isRead: false });
    const waitlist = await Waitlist.countDocuments();
    res.json({ success: true, dashboard: {
      subscribers: { total, trial, active, expired },
      revenue: { total: rev[0]?.total||0, payments: rev[0]?.payments||0 },
      plans, recent, expiring, messages: { unread }, waitlist } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Dashboard error.' });
  }
});

adminRouter.get('/subscribers', adminOnly, async (req, res) => {
  try {
    const { status, plan, page=1, limit=20, search } = req.query;
    const q = {};
    if (status) q.planStatus = status;
    if (plan) q.plan = plan;
    if (search) q.$or = [
      { businessName: { $regex: search, $options: 'i' } },
      { ownerName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const total = await Subscriber.countDocuments(q);
    const subscribers = await Subscriber.find(q).sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit)).select('-password');
    res.json({ success: true, total, page: Number(page), pages: Math.ceil(total/limit), subscribers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscribers.' });
  }
});

adminRouter.get('/subscribers/:id', adminOnly, async (req, res) => {
  try {
    const s = await Subscriber.findById(req.params.id).select('-password');
    if (!s) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, subscriber: s });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error.' });
  }
});

adminRouter.patch('/subscribers/:id', adminOnly, async (req, res) => {
  try {
    const { plan, planStatus, notes, subscriptionEndDate } = req.body;
    const s = await Subscriber.findById(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: 'Not found.' });
    if (plan) s.plan = plan;
    if (planStatus) s.planStatus = planStatus;
    if (notes) s.notes = notes;
    if (subscriptionEndDate) s.subscriptionEndDate = new Date(subscriptionEndDate);
    if (plan || planStatus === 'active') { s.accessCode = s.generateAccessCode(); s.accessCodeGeneratedAt = new Date(); }
    await s.save();
    res.json({ success: true, message: 'Updated.', subscriber: s });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed.' });
  }
});

adminRouter.post('/subscribers/:id/send-access-code', adminOnly, async (req, res) => {
  try {
    const s = await Subscriber.findById(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: 'Not found.' });
    s.accessCode = s.generateAccessCode();
    s.accessCodeGeneratedAt = new Date();
    await s.save();
    await sendEmail({ to: s.email, subject: `Your CledgeFIN Access Code — ${s.plan} Plan`,
      html: emailWrap('Access Code', `<h2>Your Access Code</h2>
      <p>Dear ${s.ownerName}, your access code is:</p>
      <div style="background:#1B2A4A;color:#B8860B;font-size:28px;font-weight:800;letter-spacing:6px;text-align:center;padding:20px;border-radius:8px;margin:16px 0">${s.accessCode}</div>
      <p>Enter this code in the app to activate your subscription.</p>
      <p>Need help? WhatsApp: <strong>+2348034041321</strong></p>`) });
    res.json({ success: true, message: `Access code sent to ${s.email}`, accessCode: s.accessCode });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

adminRouter.post('/subscribers/:id/extend', adminOnly, async (req, res) => {
  try {
    const s = await Subscriber.findById(req.params.id);
    if (!s) return res.status(404).json({ success: false, message: 'Not found.' });
    const now = new Date();
    const base = s.subscriptionEndDate && s.subscriptionEndDate > now ? s.subscriptionEndDate : now;
    s.planStatus = 'active';
    s.subscriptionEndDate = new Date(base.getTime() + 30*24*60*60*1000);
    s.accessCode = s.generateAccessCode();
    s.accessCodeGeneratedAt = now;
    await s.save();
    res.json({ success: true, message: 'Extended by 30 days.', newEndDate: s.subscriptionEndDate, accessCode: s.accessCode });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

adminRouter.delete('/subscribers/:id', adminOnly, async (req, res) => {
  try {
    await Subscriber.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed.' });
  }
});

adminRouter.get('/messages', adminOnly, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

adminRouter.patch('/messages/:id/read', adminOnly, async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

adminRouter.get('/waitlist', adminOnly, async (req, res) => {
  try {
    const list = await Waitlist.find().sort({ createdAt: -1 });
    res.json({ success: true, count: list.length, waitlist: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

adminRouter.post('/broadcast', adminOnly, async (req, res) => {
  try {
    const { subject, message, targetStatus } = req.body;
    if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject and message required.' });
    const q = targetStatus ? { planStatus: targetStatus } : {};
    const subscribers = await Subscriber.find(q).select('email ownerName businessName');
    let sent = 0;
    for (const s of subscribers) {
      await sendEmail({ to: s.email, subject,
        html: emailWrap('Message from CledgeFIN', `<h2>Dear ${s.ownerName},</h2><div>${message}</div>`) });
      sent++;
    }
    res.json({ success: true, message: `Sent to ${sent} subscribers.`, sent });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Broadcast failed.' });
  }
});

// ════════════════════════════════════════
// MOUNT ROUTES
// ════════════════════════════════════════
app.use('/api/auth',    authRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin',   adminRouter);

// ── Download Route ──
app.get('/download/:token', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.DOWNLOAD_TOKEN_SECRET);
    if (decoded.type !== 'download') return res.status(401).send('<h2>Invalid token</h2>');
    await Subscriber.findByIdAndUpdate(decoded.subscriberId, { $inc: { downloadCount: 1 }, lastDownloadDate: new Date() });
    const filePath = path.join(__dirname, 'public', 'CledgeFIN_v1.html');
    if (!fs.existsSync(filePath)) return res.status(404).send('<h2>File not found. Contact support: +2348034041321</h2>');
    res.setHeader('Content-Disposition', 'attachment; filename="CledgeFIN_v1.html"');
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(filePath);
  } catch (err) {
    res.status(401).send('<h2>Download link expired. Please log in to get a new link.</h2>');
  }
});

// ── Payment Callback ──
app.get('/payment/callback', (req, res) => {
  const { reference } = req.query;
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Successful</title>
  <style>body{font-family:Arial;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
  .card{background:#fff;border-radius:16px;padding:40px;max-width:480px;width:100%;text-align:center}
  h2{color:#1B2A4A}p{color:#5f6b7c;font-size:14px;line-height:1.7}
  .ref{background:#f0f3f8;border-radius:8px;padding:12px;font-family:monospace;color:#1B2A4A;font-size:13px;margin:16px 0}
  .btn{display:inline-block;background:#25d366;color:#fff;padding:14px 28px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px}</style>
  </head><body><div class="card"><div style="font-size:48px">✅</div>
  <h2>Payment Successful!</h2>
  <p>Your CledgeFIN subscription has been activated. Check your email for your download link and access code.</p>
  <div class="ref">Ref: ${reference||'N/A'}</div>
  <a href="https://wa.me/2348034041321?text=I just paid for CledgeFIN. Reference: ${reference}" class="btn">💬 WhatsApp Support</a>
  </div></body></html>`);
});

// ── Health ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'CledgeFIN Backend', company: 'BusinessPulse Technologies Limited',
    version: '1.0.0', timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ── Root ──
app.get('/', (req, res) => {
  res.json({ message: 'CledgeFIN API — Smart Financial Management for Growing African Businesses',
    company: 'BusinessPulse Technologies Limited', version: '1.0.0', status: 'running' });
});

// ── 404 ──
app.use('*', (req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));

// ── Error Handler ──
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Start ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 CledgeFIN Backend running on port ${PORT}`);
  console.log(`📧 Admin: ${process.env.ADMIN_EMAIL}`);
  console.log(`🗄️  MongoDB: Connecting...\n`);
});

module.exports = app;
