const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const Waitlist = require('../models/Waitlist');
const { sendEmail } = require('../emails/mailer');
const { contactFormEmail, contactAutoReply } = require('../emails/templates');

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) return res.status(400).json({ success: false, message: 'Name, email and message are required.' });
    const contact = await Contact.create({ name, email, phone, subject, message });
    const adminEmail = contactFormEmail(contact);
    await sendEmail({ to: process.env.ADMIN_EMAIL, subject: adminEmail.subject, html: adminEmail.html });
    const autoReply = contactAutoReply(contact);
    await sendEmail({ to: email, subject: autoReply.subject, html: autoReply.html });
    res.json({ success: true, message: 'Message sent. We will reply within 24 hours.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to send message. Please try WhatsApp instead.' }); }
});

router.post('/waitlist', async (req, res) => {
  try {
    const { email, name, phone, businessType } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
    const existing = await Waitlist.findOne({ email: email.toLowerCase() });
    if (existing) return res.json({ success: true, message: 'You are already on our waitlist.' });
    await Waitlist.create({ email, name, phone, businessType });
    await sendEmail({ to: process.env.ADMIN_EMAIL, subject: `[CledgeFIN] New Waitlist — ${email}`,
      html: `<p>New waitlist signup: <strong>${name||'?'}</strong> | ${email} | ${phone||'?'} | ${businessType||'?'}</p>` });
    res.json({ success: true, message: 'Added to waitlist. We will contact you soon.' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to join waitlist.' }); }
});

module.exports = router;
