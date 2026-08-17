// ═══════════════════════════════════════════════════════
//  CledgeFIN Backend Server
//  by BusinessPulse Technologies Limited
//  Smart Financial Management for Growing African Businesses
// ═══════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();

// ── CORS ──
const allowedOrigins = [
  'https://businesspulse-ng.netlify.app',
  'https://cledgefin-app.netlify.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ── Body Parsers ──
// Paystack webhook needs raw body — must come BEFORE express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static files ──
app.use(express.static(path.join(__dirname, 'public')));

// ── Connect to MongoDB ──
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ── Request Logger ──
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} — ${req.method} ${req.path}`);
  next();
});

// ── Routes ──
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/admin',   require('./routes/admin'));

// ── Secure Download Route ──
app.get('/download/:token', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.DOWNLOAD_TOKEN_SECRET);

    if (decoded.type !== 'download') {
      return res.status(401).send(errorPage('Invalid download token.'));
    }

    // Update download count
    const Subscriber = require('./models/Subscriber');
    await Subscriber.findByIdAndUpdate(decoded.subscriberId, {
      $inc: { downloadCount: 1 },
      lastDownloadDate: new Date()
    });

    const filePath = path.join(__dirname, 'public', 'CledgeFIN_v1.html');
    if (!fs.existsSync(filePath)) {
      return res.status(404).send(errorPage('App file not found. Please contact support on WhatsApp: +2348034041321'));
    }

    res.setHeader('Content-Disposition', 'attachment; filename="CledgeFIN_v1.html"');
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(filePath);

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).send(expiredPage());
    }
    res.status(401).send(errorPage('Invalid download link.'));
  }
});

// ── Payment Callback Page ──
app.get('/payment/callback', (req, res) => {
  const { reference } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>Payment Successful — CledgeFIN</title>
      <style>
        body{margin:0;font-family:Arial,sans-serif;background:#0A1628;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
        .card{background:#fff;border-radius:16px;padding:40px 32px;max-width:480px;width:100%;text-align:center}
        h2{color:#1B2A4A;margin-bottom:8px}
        p{color:#5f6b7c;font-size:14px;line-height:1.7}
        .ref{background:#f0f3f8;border-radius:8px;padding:12px;font-family:monospace;color:#1B2A4A;font-size:13px;margin:16px 0}
        .btn{display:inline-block;background:#25d366;color:#fff;padding:14px 28px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin-top:16px}
        .tick{font-size:48px;margin-bottom:16px}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="tick">✅</div>
        <h2>Payment Successful!</h2>
        <p>Your CledgeFIN subscription has been activated. Check your email for your download link and access code.</p>
        <div class="ref">Reference: ${reference || 'N/A'}</div>
        <p>If you have not received your email within 5 minutes, contact us on WhatsApp.</p>
        <a href="https://wa.me/2348034041321?text=I just paid for CledgeFIN. Reference: ${reference}" class="btn">💬 Chat on WhatsApp</a>
      </div>
    </body>
    </html>
  `);
});

// ── Health Check ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'CledgeFIN Backend',
    company: 'BusinessPulse Technologies Limited',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ── Root ──
app.get('/', (req, res) => {
  res.json({
    message: 'CledgeFIN API — Smart Financial Management for Growing African Businesses',
    company: 'BusinessPulse Technologies Limited',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      payment: '/api/payment',
      contact: '/api/contact',
      admin: '/api/admin',
      download: '/download/:token'
    }
  });
});

// ── 404 Handler ──
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ── Helper Pages ──
function errorPage(msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error — CledgeFIN</title>
  <style>body{font-family:Arial;text-align:center;padding:60px;background:#f0f3f8}
  h2{color:#1B2A4A}.btn{display:inline-block;background:#1D9E75;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px}</style>
  </head><body><h2>⚠️ ${msg}</h2>
  <a href="https://wa.me/2348034041221" class="btn">Contact Support</a></body></html>`;
}

function expiredPage() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Link Expired — CledgeFIN</title>
  <style>body{font-family:Arial;text-align:center;padding:60px;background:#f0f3f8}
  h2{color:#1B2A4A}p{color:#5f6b7c}.btn{display:inline-block;background:#1D9E75;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:16px}</style>
  </head><body><h2>⏰ Download Link Expired</h2>
  <p>Your download link has expired. Log in to get a new one.</p>
  <a href="https://cledgefin-app.netlify.app" class="btn">Go to CledgeFIN</a></body></html>`;
}

// ── Start Server ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 CledgeFIN Backend Server Started');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 App URL: ${process.env.APP_URL || 'Not set'}`);
  console.log(`🔗 Website: ${process.env.WEBSITE_URL || 'Not set'}`);
  console.log(`📧 Admin: ${process.env.ADMIN_EMAIL || 'Not set'}`);
  console.log(`🗄️  MongoDB: Connecting...`);
  console.log('────────────────────────────────\n');
});

module.exports = app;
