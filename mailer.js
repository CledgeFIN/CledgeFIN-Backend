const nodemailer = require('nodemailer');
exports.sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    const info = await transporter.sendMail({
      from: `"${process.env.APP_NAME} by ${process.env.COMPANY_NAME}" <${process.env.GMAIL_USER}>`,
      to, subject, html
    });
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return { success: true };
  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
};
