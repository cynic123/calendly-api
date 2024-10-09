const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hostEmail: { type: String }, // Field for storing host email
  attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attendeeEmail: { type: String }, // Field for storing attendee email
  day: { type: Date },
  startTime: { type: Date },
  endTime: { type: Date },
  status: { type: String, default: 'confirmed' },
  
  // Fields to store original availability for restoration upon cancellation
  originalHostAvailability: { 
    type: [{ 
      start: { type: Date },
      end: { type: Date } 
    }],
    default: [] 
  },
  originalAttendeeAvailability: { 
    type: [{ 
      start: { type: Date },
      end: { type: Date } 
    }],
    default: [] 
  }
});

appointmentSchema.index({ host: 1, day: 1 });
appointmentSchema.index({ hostEmail: 1, day: 1 });
appointmentSchema.index({ attendee: 1, day: 1 });
appointmentSchema.index({ attendeeEmail: 1, day: 1 });
appointmentSchema.index({ day: 1, startTime: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
