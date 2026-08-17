const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const SubscriberSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true },
  ownerName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  plan: { type: String, enum: ['Starter','Growth','Enterprise'], default: 'Starter' },
  planStatus: { type: String, enum: ['trial','active','expired','cancelled'], default: 'trial' },
  trialStartDate: { type: Date, default: Date.now },
  trialEndDate: { type: Date, default: () => new Date(Date.now() + 30*24*60*60*1000) },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  nextBillingDate: Date,
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
  businessCategory: { type: String, enum: ['trading','service','production','agriculture'], default: 'trading' },
  notes: String
}, { timestamps: true });

SubscriberSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
SubscriberSchema.methods.comparePassword = async function(p) { return await bcrypt.compare(p, this.password); };
SubscriberSchema.methods.isTrialActive = function() { return this.planStatus === 'trial' && new Date() < this.trialEndDate; };
SubscriberSchema.methods.isSubscriptionActive = function() { return this.planStatus === 'active' && this.subscriptionEndDate && new Date() < this.subscriptionEndDate; };
SubscriberSchema.methods.canAccessApp = function() { return this.isTrialActive() || this.isSubscriptionActive(); };
SubscriberSchema.methods.generateAccessCode = function() {
  const str = this.businessName.toUpperCase().replace(/[^A-Z0-9]/g,'');
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
  let code = Math.abs(hash).toString(36).toUpperCase().slice(0,6);
  while (code.length < 6) code = '0' + code;
  return 'BP-' + code;
};
module.exports = mongoose.model('Subscriber', SubscriberSchema);
