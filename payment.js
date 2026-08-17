const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Subscriber = require('../models/Subscriber');
const { sendEmail } = require('../emails/mailer');
const { paymentConfirmationEmail, adminNotificationEmail } = require('../emails/templates');
const { protect } = require('../middleware/auth');

const PLAN_PRICES = {
  Starter:    { amount: 500000,  name: 'CledgeFIN Starter Plan' },
  Growth:     { amount: 1000000, name: 'CledgeFIN Growth Plan' },
  Enterprise: { amount: 1500000, name: 'CledgeFIN Enterprise Plan' }
};

router.post('/initialize', protect, async (req, res) => {
  try {
    const { plan } = req.body;
    const subscriber = req.subscriber;
    if (!PLAN_PRICES[plan]) return res.status(400).json({ success: false, message: 'Invalid plan.' });
    const planInfo = PLAN_PRICES[plan];
    const reference = `CF-${subscriber._id}-${Date.now()}`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: subscriber.email, amount: planInfo.amount, reference, currency: 'NGN',
        metadata: { subscriberId: subscriber._id.toString(), businessName: subscriber.businessName, plan },
        callback_url: `${process.env.APP_URL}/payment/callback` })
    });
    const data = await response.json();
    if (!data.status) return res.status(400).json({ success: false, message: 'Payment initialization failed.' });
    res.json({ success: true, authorizationUrl: data.data.authorization_url, reference: data.data.reference });
  } catch (err) { res.status(500).json({ success: false, message: 'Payment initialization failed.' }); }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
      subscriber.nextBillingDate = endDate; subscriber.lastPaymentDate = now;
      subscriber.lastPaymentAmount = amount/100; subscriber.lastPaymentReference = reference;
      subscriber.totalPayments += 1; subscriber.totalRevenue += amount/100;
      subscriber.accessCode = subscriber.generateAccessCode();
      subscriber.accessCodeGeneratedAt = now;
      subscriber.payments.push({ reference, amount: amount/100, plan, date: now, status: 'success' });
      await subscriber.save();
      const payEmail = paymentConfirmationEmail(subscriber, { amount, reference });
      await sendEmail({ to: subscriber.email, subject: payEmail.subject, html: payEmail.html });
      const adminEmail = adminNotificationEmail(subscriber, `Payment &#8358;${(amount/100).toLocaleString()} — ${plan}`);
      await sendEmail({ to: process.env.ADMIN_EMAIL, subject: adminEmail.subject, html: adminEmail.html });
    }
    res.sendStatus(200);
  } catch (err) { console.error('Webhook error:', err); res.sendStatus(200); }
});

router.get('/verify/:reference', protect, async (req, res) => {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${req.params.reference}`,
      { headers: { 'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } });
    const data = await response.json();
    const subscriber = await Subscriber.findById(req.subscriber._id);
    res.json({ success: true, paid: data.data.status === 'success', plan: subscriber.plan,
      planStatus: subscriber.planStatus, subscriptionEndDate: subscriber.subscriptionEndDate, accessCode: subscriber.accessCode });
  } catch (err) { res.status(500).json({ success: false, message: 'Verification failed.' }); }
});

router.get('/history', protect, async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.subscriber._id);
    res.json({ success: true, payments: subscriber.payments, totalPayments: subscriber.totalPayments, totalRevenue: subscriber.totalRevenue });
  } catch (err) { res.status(500).json({ success: false, message: 'Could not fetch history.' }); }
});

module.exports = router;
