const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const Contact = require('../models/Contact');
const Waitlist = require('../models/Waitlist');
const { sendEmail } = require('../emails/mailer');
const { adminOnly } = require('../middleware/auth');

// All admin routes require admin key header: x-admin-key

// ── GET /api/admin/dashboard ──
router.get('/dashboard', adminOnly, async (req, res) => {
  try {
    const now = new Date();

    // Subscriber counts
    const totalSubscribers = await Subscriber.countDocuments();
    const trialSubscribers = await Subscriber.countDocuments({ planStatus: 'trial' });
    const activeSubscribers = await Subscriber.countDocuments({ planStatus: 'active' });
    const expiredSubscribers = await Subscriber.countDocuments({ planStatus: 'expired' });

    // Revenue
    const revenueData = await Subscriber.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: '$totalRevenue' }, totalPayments: { $sum: '$totalPayments' } } }
    ]);
    const totalRevenue = revenueData[0]?.totalRevenue || 0;
    const totalPayments = revenueData[0]?.totalPayments || 0;

    // Plan breakdown
    const planBreakdown = await Subscriber.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);

    // Monthly revenue (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyRevenue = await Subscriber.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$payments.date' },
            month: { $month: '$payments.date' }
          },
          revenue: { $sum: '$payments.amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Recent subscribers
    const recentSubscribers = await Subscriber.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('businessName ownerName email plan planStatus createdAt totalRevenue');

    // Trials expiring in 3 days
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const expiringTrials = await Subscriber.find({
      planStatus: 'trial',
      trialEndDate: { $lte: threeDaysFromNow, $gte: now }
    }).select('businessName ownerName email phone trialEndDate');

    // Messages
    const unreadMessages = await Contact.countDocuments({ isRead: false });
    const totalMessages = await Contact.countDocuments();
    const waitlistCount = await Waitlist.countDocuments();

    res.json({
      success: true,
      dashboard: {
        subscribers: { total: totalSubscribers, trial: trialSubscribers, active: activeSubscribers, expired: expiredSubscribers },
        revenue: { total: totalRevenue, totalPayments },
        planBreakdown,
        monthlyRevenue,
        recentSubscribers,
        expiringTrials,
        messages: { unread: unreadMessages, total: totalMessages },
        waitlist: waitlistCount
      }
    });

  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, message: 'Failed to load dashboard.' });
  }
});

// ── GET /api/admin/subscribers ──
router.get('/subscribers', adminOnly, async (req, res) => {
  try {
    const { status, plan, page = 1, limit = 20, search } = req.query;
    const query = {};
    if (status) query.planStatus = status;
    if (plan) query.plan = plan;
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Subscriber.countDocuments(query);
    const subscribers = await Subscriber.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-password -passwordResetToken -emailVerificationToken');

    res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      subscribers
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscribers.' });
  }
});

// ── GET /api/admin/subscribers/:id ──
router.get('/subscribers/:id', adminOnly, async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id).select('-password');
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found.' });
    res.json({ success: true, subscriber });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch subscriber.' });
  }
});

// ── PATCH /api/admin/subscribers/:id ──
// Update subscriber plan, status or notes
router.patch('/subscribers/:id', adminOnly, async (req, res) => {
  try {
    const { plan, planStatus, notes, subscriptionEndDate } = req.body;
    const subscriber = await Subscriber.findById(req.params.id);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found.' });

    if (plan) subscriber.plan = plan;
    if (planStatus) subscriber.planStatus = planStatus;
    if (notes) subscriber.notes = notes;
    if (subscriptionEndDate) subscriber.subscriptionEndDate = new Date(subscriptionEndDate);

    // Regenerate access code if plan changed
    if (plan || planStatus === 'active') {
      subscriber.accessCode = subscriber.generateAccessCode();
      subscriber.accessCodeGeneratedAt = new Date();
    }

    await subscriber.save();
    res.json({ success: true, message: 'Subscriber updated.', subscriber });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update subscriber.' });
  }
});

// ── POST /api/admin/subscribers/:id/send-access-code ──
router.post('/subscribers/:id/send-access-code', adminOnly, async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found.' });

    subscriber.accessCode = subscriber.generateAccessCode();
    subscriber.accessCodeGeneratedAt = new Date();
    await subscriber.save();

    await sendEmail({
      to: subscriber.email,
      subject: `Your CledgeFIN Access Code — ${subscriber.plan} Plan`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;background:#f8f9fc;border-radius:12px">
          <h2 style="color:#1B2A4A">Your CledgeFIN Access Code</h2>
          <p>Dear ${subscriber.ownerName},</p>
          <p>Your access code for <strong>${subscriber.plan} Plan</strong> is:</p>
          <div style="background:#1B2A4A;color:#B8860B;font-size:28px;font-weight:800;letter-spacing:6px;text-align:center;padding:20px;border-radius:8px;margin:20px 0">
            ${subscriber.accessCode}
          </div>
          <p>Enter this code in the app when prompted to activate your subscription.</p>
          <p>Need help? WhatsApp us: <strong>+2348034041321</strong></p>
          <p style="color:#94a3b8;font-size:12px">CledgeFIN by BusinessPulse Technologies Limited</p>
        </div>
      `
    });

    res.json({ success: true, message: `Access code sent to ${subscriber.email}`, accessCode: subscriber.accessCode });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send access code.' });
  }
});

// ── POST /api/admin/subscribers/:id/extend ──
// Manually extend subscription by 30 days
router.post('/subscribers/:id/extend', adminOnly, async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.params.id);
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found.' });

    const now = new Date();
    const base = subscriber.subscriptionEndDate && subscriber.subscriptionEndDate > now
      ? subscriber.subscriptionEndDate
      : now;

    subscriber.planStatus = 'active';
    subscriber.subscriptionEndDate = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    subscriber.accessCode = subscriber.generateAccessCode();
    subscriber.accessCodeGeneratedAt = now;
    await subscriber.save();

    res.json({
      success: true,
      message: 'Subscription extended by 30 days.',
      newEndDate: subscriber.subscriptionEndDate,
      accessCode: subscriber.accessCode
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to extend subscription.' });
  }
});

// ── DELETE /api/admin/subscribers/:id ──
router.delete('/subscribers/:id', adminOnly, async (req, res) => {
  try {
    await Subscriber.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Subscriber deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete subscriber.' });
  }
});

// ── GET /api/admin/messages ──
router.get('/messages', adminOnly, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

// ── PATCH /api/admin/messages/:id/read ──
router.patch('/messages/:id/read', adminOnly, async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true, message: 'Message marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update message.' });
  }
});

// ── GET /api/admin/waitlist ──
router.get('/waitlist', adminOnly, async (req, res) => {
  try {
    const waitlist = await Waitlist.find().sort({ createdAt: -1 });
    res.json({ success: true, count: waitlist.length, waitlist });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch waitlist.' });
  }
});

// ── POST /api/admin/broadcast ──
// Send email to all active subscribers
router.post('/broadcast', adminOnly, async (req, res) => {
  try {
    const { subject, message, targetStatus } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required.' });
    }

    const query = targetStatus ? { planStatus: targetStatus } : {};
    const subscribers = await Subscriber.find(query).select('email ownerName businessName');

    let sent = 0;
    for (const sub of subscribers) {
      await sendEmail({
        to: sub.email,
        subject,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px">
            <h2 style="color:#1B2A4A">Dear ${sub.ownerName},</h2>
            <div style="color:#374151;line-height:1.8">${message}</div>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e3e8f0">
            <p style="color:#94a3b8;font-size:12px">CledgeFIN by BusinessPulse Technologies Limited<br>WhatsApp: +2348034041321</p>
          </div>
        `
      });
      sent++;
    }

    res.json({ success: true, message: `Broadcast sent to ${sent} subscriber(s).`, sent });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Broadcast failed.' });
  }
});

module.exports = router;
