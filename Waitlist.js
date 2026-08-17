const mongoose = require('mongoose');
const WaitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, trim: true },
  phone: { type: String, trim: true },
  businessType: { type: String, trim: true },
  convertedToSubscriber: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('Waitlist', WaitlistSchema);
