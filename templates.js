const hdr = (t) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{margin:0;padding:0;background:#f0f3f8;font-family:Arial,sans-serif;}
.w{max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08);}
.h{background:#1B2A4A;padding:28px 32px;text-align:center;}
.h h1{color:#B8860B;font-size:24px;margin:0;font-family:Georgia,serif;}
.h p{color:rgba(255,255,255,.7);font-size:11px;margin:4px 0 0;}
.b{padding:32px;} .b h2{color:#1B2A4A;font-size:18px;}
.b p{color:#374151;font-size:14px;line-height:1.8;margin-bottom:12px;}
.btn{display:inline-block;background:#1D9E75;color:#fff!important;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin:14px 0;}
.card{background:#f8f9fc;border-radius:8px;padding:14px 18px;margin:14px 0;border-left:4px solid #B8860B;}
.card p{margin:3px 0;color:#1B2A4A;font-size:13px;} .card strong{color:#B8860B;}
.ft{background:#f8f9fc;padding:18px 32px;text-align:center;border-top:1px solid #e3e8f0;}
.ft p{color:#94a3b8;font-size:11px;margin:3px 0;} .ft a{color:#1D9E75;text-decoration:none;}
</style></head><body><div class="w"><div class="h"><h1>${process.env.APP_NAME||'CledgeFIN'}</h1><p>by ${process.env.COMPANY_NAME||'BusinessPulse Technologies Limited'}</p></div><div class="b">`;
const ftr = () => `</div><div class="ft"><p>Smart Financial Management for Growing African Businesses</p><p><a href="${process.env.WEBSITE_URL||'#'}">Website</a> &nbsp;|&nbsp; <a href="https://wa.me/2348034041321">WhatsApp Support</a></p><p>&copy; ${new Date().getFullYear()} ${process.env.COMPANY_NAME||'BusinessPulse Technologies Limited'}</p></div></div></body></html>`;

exports.welcomeEmail = (s, downloadLink) => ({
  subject: `Welcome to ${process.env.APP_NAME}! Your app is ready`,
  html: hdr('Welcome') + `<h2>Welcome, ${s.ownerName}!</h2>
  <p>Your account is created and your app is ready to download.</p>
  <div class="card"><p><strong>Business:</strong> ${s.businessName}</p><p><strong>Plan:</strong> ${s.plan}</p><p><strong>Trial:</strong> 30 days</p><p><strong>Access Code:</strong> ${s.accessCode}</p></div>
  <p style="text-align:center"><a href="${downloadLink}" class="btn">Download CledgeFIN App</a></p>
  <p style="font-size:12px;color:#94a3b8;text-align:center">Link expires in 7 days</p>
  <p><strong>Steps:</strong> Download → Open in Chrome/Edge → Complete setup → Start managing your finances.</p>
  <p>Questions? WhatsApp: <strong>+2348034041321</strong></p>` + ftr()
});

exports.paymentConfirmationEmail = (s, payment) => ({
  subject: `Payment confirmed — ${process.env.APP_NAME} ${s.plan} Plan`,
  html: hdr('Payment Confirmed') + `<h2>Payment Received ✅</h2>
  <p>Dear ${s.ownerName}, your payment is confirmed and subscription is active.</p>
  <div class="card"><p><strong>Business:</strong> ${s.businessName}</p><p><strong>Plan:</strong> ${s.plan}</p>
  <p><strong>Amount:</strong> &#8358;${(payment.amount/100).toLocaleString()}</p>
  <p><strong>Reference:</strong> ${payment.reference}</p>
  <p><strong>Valid Until:</strong> ${new Date(s.subscriptionEndDate).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}</p></div>
  <p>Your access code: <strong style="font-size:20px;color:#B8860B;letter-spacing:2px">${s.accessCode}</strong></p>
  <p>Enter this in the app when prompted to unlock your subscription.</p>
  <p>WhatsApp: <strong>+2348034041321</strong></p>` + ftr()
});

exports.trialExpiryEmail = (s, daysLeft) => ({
  subject: `Your CledgeFIN trial expires in ${daysLeft} day${daysLeft===1?'':'s'}`,
  html: hdr('Trial Expiring') + `<h2>Trial ends in ${daysLeft} day${daysLeft===1?'':'s'} &#x23F0;</h2>
  <p>Dear ${s.ownerName}, your free trial for CledgeFIN will expire soon.</p>
  <div class="card"><p><strong>Business:</strong> ${s.businessName}</p>
  <p><strong>Trial Ends:</strong> ${new Date(s.trialEndDate).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}</p></div>
  <p>&#x1F7E2; <strong>Starter &#8358;5,000/month</strong> — Core modules</p>
  <p>&#x1F535; <strong>Growth &#8358;10,000/month</strong> — All modules + Reports + Health Score</p>
  <p>&#x1F7E1; <strong>Enterprise &#8358;15,000/month</strong> — Everything + BOM + Production + COGS</p>
  <p style="text-align:center"><a href="https://wa.me/2348034041321" class="btn">Subscribe Now</a></p>` + ftr()
});

exports.adminNotificationEmail = (s, event) => ({
  subject: `[CledgeFIN Admin] ${event} — ${s.businessName}`,
  html: hdr('Admin Alert') + `<h2>${event}</h2>
  <div class="card"><p><strong>Business:</strong> ${s.businessName}</p><p><strong>Owner:</strong> ${s.ownerName}</p>
  <p><strong>Email:</strong> ${s.email}</p><p><strong>Phone:</strong> ${s.phone}</p>
  <p><strong>Plan:</strong> ${s.plan}</p><p><strong>Status:</strong> ${s.planStatus}</p>
  <p><strong>Time:</strong> ${new Date().toLocaleString('en-NG')}</p></div>` + ftr()
});

exports.contactFormEmail = (c) => ({
  subject: `[CledgeFIN Website] New message from ${c.name}`,
  html: hdr('New Contact') + `<h2>New Message</h2>
  <div class="card"><p><strong>Name:</strong> ${c.name}</p><p><strong>Email:</strong> ${c.email}</p>
  <p><strong>Phone:</strong> ${c.phone||'Not provided'}</p><p><strong>Subject:</strong> ${c.subject||'Not specified'}</p></div>
  <p><strong>Message:</strong></p>
  <p style="background:#f8f9fc;padding:16px;border-radius:8px;border-left:4px solid #1D9E75">${c.message}</p>
  <p>Reply to: <a href="mailto:${c.email}">${c.email}</a></p>` + ftr()
});

exports.contactAutoReply = (c) => ({
  subject: `We received your message — CledgeFIN`,
  html: hdr('Message Received') + `<h2>Thank you, ${c.name}!</h2>
  <p>We received your message and will reply within 24 hours (Mon–Fri, 8am–6pm Nigerian time).</p>
  <p>For urgent help: <a href="https://wa.me/2348034041321" class="btn">Chat on WhatsApp</a></p>` + ftr()
});
