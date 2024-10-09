const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  timeSlots: [{
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  }]
}, { strict: false });

availabilitySchema.index({ userId: 1, 'availableTimes.date': 1 });

module.exports = mongoose.model('Availability', availabilitySchema);