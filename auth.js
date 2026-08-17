const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Subscriber = require('../models/Subscriber');
const { sendEmail } = require('../emails/mailer');
const { welcomeEmail, adminNotificationEmail } = require('../emails/templates');
const { protect, generateToken } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { businessName, ownerName, email, phone, password, plan, businessCategory } = req.body;
    if (!businessName || !ownerName || !email || !phone || !password)
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    const existing = await Subscriber.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Email already registered. Please log in.' });
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
    const downloadToken = jwt.sign({ subscriberId: subscriber._id, type: 'download' }, process.env.DOWNLOAD_TOKEN_SECRET, { expiresIn: '7d' });
    const downloadLink = `${process.env.APP_URL}/download/${downloadToken}`;
    const welcome = welcomeEmail(subscriber, downloadLink);
    await sendEmail({ to: subscriber.email, subject: welcome.subject, html: welcome.html });
    const notif = adminNotificationEmail(subscriber, 'New Registration');
    await sendEmail({ to: process.env.ADMIN_EMAIL, subject: notif.subject, html: notif.html });
    const token = generateToken(subscriber._id);
    res.status(201).json({ success: true, message: 'Account created. Check your email for the download link.', token,
      subscriber: { id: subscriber._id, businessName: subscriber.businessName, ownerName: subscriber.ownerName,
        email: subscriber.email, plan: subscriber.plan, planStatus: subscriber.planStatus,
        trialEndDate: subscriber.trialEndDate, accessCode: subscriber.accessCode } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
    const subscriber = await Subscriber.findOne({ email: email.toLowerCase() }).select('+password');
    if (!subscriber || !(await subscriber.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = generateToken(subscriber._id);
    res.json({ success: true, token, subscriber: { id: subscriber._id, businessName: subscriber.businessName,
      ownerName: subscriber.ownerName, email: subscriber.email, plan: subscriber.plan,
      planStatus: subscriber.planStatus, trialEndDate: subscriber.trialEndDate,
      subscriptionEndDate: subscriber.subscriptionEndDate, accessCode: subscriber.accessCode,
      canAccess: subscriber.canAccessApp() } });
  } catch (err) { res.status(500).json({ success: false, message: 'Login failed.' }); }
});

router.get('/me', protect, async (req, res) => {
  try {
    const subscriber = await Subscriber.findById(req.subscriber._id);
    res.json({ success: true, subscriber: { id: subscriber._id, businessName: subscriber.businessName,
      ownerName: subscriber.ownerName, email: subscriber.email, phone: subscriber.phone,
      plan: subscriber.plan, planStatus: subscriber.planStatus, trialEndDate: subscriber.trialEndDate,
      subscriptionEndDate: subscriber.subscriptionEndDate, accessCode: subscriber.accessCode,
      canAccess: subscriber.canAccessApp(), downloadCount: subscriber.downloadCount } });
  } catch (err) { res.status(500).json({ success: false, message: 'Could not fetch profile.' }); }
});

router.get('/download-link', protect, async (req, res) => {
  try {
    const subscriber = req.subscriber;
    if (!subscriber.canAccessApp()) return res.status(403).json({ success: false, message: 'Subscription expired. Please renew.' });
    const downloadToken = jwt.sign({ subscriberId: subscriber._id, type: 'download' }, process.env.DOWNLOAD_TOKEN_SECRET, { expiresIn: '24h' });
    res.json({ success: true, downloadLink: `${process.env.APP_URL}/download/${downloadToken}`, expiresIn: '24 hours' });
  } catch (err) { res.status(500).json({ success: false, message: 'Could not generate download link.' }); }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const subscriber = await Subscriber.findOne({ email: req.body.email?.toLowerCase() });
    if (!subscriber) return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    const resetToken = crypto.randomBytes(32).toString('hex');
    subscriber.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    subscriber.passwordResetExpires = new Date(Date.now() + 10*60*1000);
    await subscriber.save();
    const resetLink = `${process.env.APP_URL}/reset-password/${resetToken}`;
    await sendEmail({ to: subscriber.email, subject: 'CledgeFIN Password Reset',
      html: `<p>Reset your password (expires in 10 minutes): <a href="${resetLink}">${resetLink}</a></p>` });
    res.json({ success: true, message: 'Password reset link sent.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to send reset email.' }); }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const subscriber = await Subscriber.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
    if (!subscriber) return res.status(400).json({ success: false, message: 'Token is invalid or expired.' });
    subscriber.password = req.body.password;
    subscriber.passwordResetToken = undefined;
    subscriber.passwordResetExpires = undefined;
    await subscriber.save();
    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Password reset failed.' }); }
});

module.exports = router;
