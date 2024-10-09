const User = require('../models/User');
const Availability = require('../models/Availability');
const Appointment = require('../models/Appointment');
const moment = require('moment-timezone');

exports.bookAppointment = async (req, res) => {
  try {
    const { hostEmail, attendeeEmail, startTime, endTime, timezone } = req.body;

    if (!hostEmail || !attendeeEmail || !startTime || !endTime || !timezone) {
      return res.status(400).json({ message: 'Host email, attendee email, start time, end time, and timezone are required' });
    }

    const [host, attendee] = await Promise.all([
      User.findOne({ email: hostEmail }),
      User.findOne({ email: attendeeEmail })
    ]);

    if (!host || !attendee) {
      return res.status(404).json({ message: 'Host or attendee not found' });
    }

    // Convert start and end times to UTC
    const startTimeUTC = moment.tz(startTime, timezone).utc();
    const endTimeUTC = moment.tz(endTime, timezone).utc();

    // Calculate the start of the day in the host's timezone, then convert to UTC
    const dayStartHostTimezone = moment.tz(startTime, timezone).startOf('day');
    const dayUTC = dayStartHostTimezone.utc().toDate();

    const hostAvailability = await Availability.findOne({ userId: host._id, date: dayUTC });
    const attendeeAvailability = await Availability.findOne({ userId: attendee._id, date: dayUTC });

    if (!hostAvailability || !attendeeAvailability) {
      return res.status(404).json({ message: 'Host or attendee availability not found for the specified date' });
    }

    // Check if the time slot is available for both the host and the attendee
    const overlappingHostSlots = hostAvailability.timeSlots.filter(slot =>
      startTimeUTC.isSameOrAfter(moment.utc(slot.start)) && endTimeUTC.isSameOrBefore(moment.utc(slot.end))
    );
    const overlappingAttendeeSlots = attendeeAvailability.timeSlots.filter(slot =>
      startTimeUTC.isSameOrAfter(moment.utc(slot.start)) && endTimeUTC.isSameOrBefore(moment.utc(slot.end))
    );

    if (overlappingHostSlots.length === 0 || overlappingAttendeeSlots.length === 0) {
      return res.status(400).json({ message: 'The selected time slot is not available for the host or the attendee' });
    }

    // Store only the overlapping slots for restoration upon cancellation
    const originalHostAvailability = [...overlappingHostSlots];
    const originalAttendeeAvailability = [...overlappingAttendeeSlots];

    // Create and save the appointment
    const appointment = new Appointment({
      host: host._id,
      hostEmail: hostEmail,
      attendee: attendee._id,
      attendeeEmail: attendeeEmail,
      day: dayUTC,
      startTime: startTimeUTC.toDate(),
      endTime: endTimeUTC.toDate(),
      status: 'confirmed',
      originalHostAvailability,
      originalAttendeeAvailability // Save the original overlapping slots
    });

    await appointment.save();

    // **Update availabilities by splitting the time slots around the booked time**
    hostAvailability.timeSlots = splitAndUpdateAvailability(hostAvailability.timeSlots, startTimeUTC, endTimeUTC);
    attendeeAvailability.timeSlots = splitAndUpdateAvailability(attendeeAvailability.timeSlots, startTimeUTC, endTimeUTC);

    await Promise.all([hostAvailability.save(), attendeeAvailability.save()]);

    // Convert appointment times back to the requested timezone for the response
    const responseAppointment = {
      host: hostEmail,
      attendee: attendeeEmail,
      day: moment(appointment.day).tz(timezone).format('YYYY-MM-DD'),
      startTime: moment(appointment.startTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      endTime: moment(appointment.endTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      status: appointment.status
    };

    res.status(201).json(responseAppointment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Helper function to split availability and update
const splitAndUpdateAvailability = (timeSlots, startTime, endTime) => {
  let updatedSlots = [];

  timeSlots.forEach(slot => {
    const slotStart = moment.utc(slot.start);
    const slotEnd = moment.utc(slot.end);

    if (startTime.isSameOrAfter(slotEnd) || endTime.isSameOrBefore(slotStart)) {
      // No overlap, keep the slot
      updatedSlots.push(slot);
    } else {
      // Overlap, split the availability into two parts
      if (slotStart.isBefore(startTime)) {
        // Part before the booked time
        updatedSlots.push({ start: slotStart.toDate(), end: startTime.toDate() });
      }
      if (slotEnd.isAfter(endTime)) {
        // Part after the booked time
        updatedSlots.push({ start: endTime.toDate(), end: slotEnd.toDate() });
      }
    }
  });

  return updatedSlots;
};

exports.getAppointmentsByRange = async (req, res) => {
  try {
    const { email, startDate, endDate, timezone } = req.query;

    // Ensure that email, startDate, endDate, and timezone are provided
    if (!email || !startDate || !endDate || !timezone) {
      return res.status(400).json({ message: 'Email, startDate, endDate, and timezone are required' });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert start and end dates to UTC based on the caller's timezone
    const startDayUTC = moment.tz(startDate, timezone).utc().startOf('day').toDate();
    const endDayUTC = moment.tz(endDate, timezone).utc().endOf('day').toDate();

    // Find appointments where the user is either the host or the attendee
    const appointments = await Appointment.find({
      $or: [{ host: user._id }, { attendee: user._id }],
      day: { $gte: startDayUTC, $lte: endDayUTC }
    }).sort('startTime');

    // Return the appointments with only emails for host and attendee
    const formattedAppointments = appointments.map(apt => ({
      _id: apt._id,
      host: apt.hostEmail, // Only keep the email for host
      attendee: apt.attendeeEmail, // Only keep the email for attendee
      day: moment(apt.day).tz(timezone).format('YYYY-MM-DD'), // Keep the day in the caller's timezone
      startTime: moment(apt.startTime).tz(timezone).format('YYYY-MM-DD HH:mm'), // Convert to the caller's timezone
      endTime: moment(apt.endTime).tz(timezone).format('YYYY-MM-DD HH:mm'), // Convert to the caller's timezone
      status: apt.status
    }));

    res.json(formattedAppointments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAppointmentsByDate = async (req, res) => {
  try {
    const { email, date, timezone } = req.query;

    // Ensure that email, date, and timezone are provided
    if (!email || !date || !timezone) {
      return res.status(400).json({ message: 'Email, date, and timezone are required' });
    }

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert the date to UTC based on the caller's timezone
    const dateUTC = moment.tz(date, timezone).startOf('day').utc().toDate();

    // Find appointments where the user is either the host or the attendee for the specified date
    const appointments = await Appointment.find({
      $or: [{ host: user._id }, { attendee: user._id }],
      day: dateUTC
    }).sort('startTime');

    // Format the appointments
    const formattedAppointments = appointments.map(apt => ({
      _id: apt._id,
      host: apt.hostEmail,
      attendee: apt.attendeeEmail,
      day: moment(apt.day).tz(timezone).format('YYYY-MM-DD'),
      startTime: moment(apt.startTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      endTime: moment(apt.endTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      status: apt.status
    }));

    res.json(formattedAppointments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { email, timezone } = req.body;

    if (!email || !timezone) {
      return res.status(400).json({ message: 'Email and timezone are required' });
    }

    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Find the user by their email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user is the host or attendee of the appointment
    if (appointment.hostEmail !== email && appointment.attendeeEmail !== email) {
      return res.status(403).json({ message: 'Unauthorized to cancel this appointment' });
    }

    // Update the status to 'cancelled'
    appointment.status = 'cancelled';
    await appointment.save();

    // Restore and merge the original availability for both host and attendee
    const hostAvailability = await Availability.findOne({ userId: appointment.host, date: appointment.day });
    const attendeeAvailability = await Availability.findOne({ userId: appointment.attendee, date: appointment.day });

    if (hostAvailability) {
      hostAvailability.timeSlots = mergeAvailabilities(hostAvailability.timeSlots, appointment.originalHostAvailability);
      await hostAvailability.save();
    }

    if (attendeeAvailability) {
      attendeeAvailability.timeSlots = mergeAvailabilities(attendeeAvailability.timeSlots, appointment.originalAttendeeAvailability);
      await attendeeAvailability.save();
    }

    // Convert appointment times back to the requested timezone for the response
    const responseAppointment = {
      host: appointment.hostEmail,
      attendee: appointment.attendeeEmail,
      day: moment(appointment.day).tz(timezone).format('YYYY-MM-DD'),
      startTime: moment(appointment.startTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      endTime: moment(appointment.endTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      status: appointment.status
    };

    res.json(responseAppointment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Helper function to merge availabilities
const mergeAvailabilities = (existingTimeSlots, restoredTimeSlots) => {
  const allSlots = [...existingTimeSlots, ...restoredTimeSlots];

  // Sort by start time
  allSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

  // Merge intervals if overlapping or adjacent
  const mergedSlots = [];
  let current = allSlots[0];

  for (let i = 1; i < allSlots.length; i++) {
    const next = allSlots[i];

    // If the current slot overlaps or is adjacent to the next, merge them
    if (moment.utc(current.end).isSameOrAfter(moment.utc(next.start))) {
      current.end = moment.utc(current.end).isAfter(moment.utc(next.end)) ? current.end : next.end;
    } else {
      mergedSlots.push(current);
      current = next;
    }
  }

  // Push the last merged interval
  mergedSlots.push(current);

  return mergedSlots;
};

exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { email, newStartTime, newEndTime, timezone } = req.body;

    if (!email || !newStartTime || !newEndTime || !timezone) {
      return res.status(400).json({ message: 'Email, new start/end times, and timezone are required' });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.hostEmail !== email && appointment.attendeeEmail !== email) {
      return res.status(403).json({ message: 'Unauthorized to reschedule this appointment' });
    }

    // Convert new times to UTC
    const newStartTimeUTC = moment.tz(newStartTime, timezone).utc();
    const newEndTimeUTC = moment.tz(newEndTime, timezone).utc();

    // Calculate the start of the day in the host's timezone, then convert to UTC
    const newDayStartHostTimezone = moment.tz(newStartTime, timezone).startOf('day');
    const newDayUTC = newDayStartHostTimezone.utc().toDate();

    // Restore original availability for the old date
    const oldHostAvailability = await Availability.findOne({ userId: appointment.host, date: appointment.day });
    const oldAttendeeAvailability = await Availability.findOne({ userId: appointment.attendee, date: appointment.day });

    if (oldHostAvailability) {
      oldHostAvailability.timeSlots = mergeAvailabilities(oldHostAvailability.timeSlots, appointment.originalHostAvailability);
      await oldHostAvailability.save();
    }

    if (oldAttendeeAvailability) {
      oldAttendeeAvailability.timeSlots = mergeAvailabilities(oldAttendeeAvailability.timeSlots, appointment.originalAttendeeAvailability);
      await oldAttendeeAvailability.save();
    }

    // Find availabilities for the new date
    const newHostAvailability = await Availability.findOne({ userId: appointment.host, date: newDayUTC });
    const newAttendeeAvailability = await Availability.findOne({ userId: appointment.attendee, date: newDayUTC });

    if (!newHostAvailability || !newAttendeeAvailability) {
      return res.status(404).json({ message: 'Host or attendee availability not found for the new date' });
    }

    // Find and store the new overlapping slots for restoration upon future cancellation
    const overlappingHostSlots = newHostAvailability.timeSlots.filter(slot =>
      newStartTimeUTC.isSameOrAfter(moment.utc(slot.start)) && newEndTimeUTC.isSameOrBefore(moment.utc(slot.end))
    );
    const overlappingAttendeeSlots = newAttendeeAvailability.timeSlots.filter(slot =>
      newStartTimeUTC.isSameOrAfter(moment.utc(slot.start)) && newEndTimeUTC.isSameOrBefore(moment.utc(slot.end))
    );

    if (overlappingHostSlots.length === 0 || overlappingAttendeeSlots.length === 0) {
      return res.status(400).json({ message: 'The selected time slot is not available for the host or the attendee' });
    }

    // Update appointment
    appointment.originalHostAvailability = [...overlappingHostSlots];
    appointment.originalAttendeeAvailability = [...overlappingAttendeeSlots];
    appointment.startTime = newStartTimeUTC.toDate();
    appointment.endTime = newEndTimeUTC.toDate();
    appointment.day = newDayUTC;
    appointment.status = 'confirmed';

    await appointment.save();

    // Split the host's and attendee's availability based on the new rescheduled time
    newHostAvailability.timeSlots = splitAndUpdateAvailability(newHostAvailability.timeSlots, newStartTimeUTC, newEndTimeUTC);
    newAttendeeAvailability.timeSlots = splitAndUpdateAvailability(newAttendeeAvailability.timeSlots, newStartTimeUTC, newEndTimeUTC);

    // Save the newly updated availabilities
    await Promise.all([newHostAvailability.save(), newAttendeeAvailability.save()]);

    // Response with updated appointment in user's timezone
    const responseAppointment = {
      host: appointment.hostEmail,
      attendee: appointment.attendeeEmail,
      day: moment(appointment.day).tz(timezone).format('YYYY-MM-DD'),
      startTime: moment(appointment.startTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      endTime: moment(appointment.endTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      status: appointment.status
    };

    res.json(responseAppointment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.findOverlapByRange = async (req, res) => {
  try {
    const { email1, email2, startDate, endDate, timezone } = req.query;

    // Validate input
    if (!email1 || !email2 || !startDate || !endDate || !timezone) {
      return res.status(400).json({ message: 'Both emails, startDate, endDate, and timezone are required' });
    }

    // Find users
    const [user1, user2] = await Promise.all([
      User.findOne({ email: email1 }),
      User.findOne({ email: email2 })
    ]);

    if (!user1 || !user2) {
      return res.status(404).json({ message: 'One or both users not found' });
    }

    // Convert dates to UTC
    const startUTC = moment.tz(startDate, timezone).utc().startOf('day').toDate();
    const endUTC = moment.tz(endDate, timezone).utc().endOf('day').toDate();

    // Fetch appointments for both users
    const [user1Appointments, user2Appointments] = await Promise.all([
      Appointment.find({
        $or: [{ host: user1._id }, { attendee: user1._id }],
        day: { $gte: startUTC, $lte: endUTC },
        status: 'confirmed'  // Only consider confirmed appointments
      }),
      Appointment.find({
        $or: [{ host: user2._id }, { attendee: user2._id }],
        day: { $gte: startUTC, $lte: endUTC },
        status: 'confirmed'  // Only consider confirmed appointments
      })
    ]);

    // Find overlapping appointments
    const overlappingAppointments = [];

    for (const apt1 of user1Appointments) {
      for (const apt2 of user2Appointments) {
        if (apt1._id.equals(apt2._id)) {
          // This is the same appointment, both users are involved
          overlappingAppointments.push(apt1);
        }
      }
    }

    // Format the overlapping appointments
    const formattedOverlaps = overlappingAppointments.map(apt => ({
      _id: apt._id,
      host: apt.hostEmail,
      attendee: apt.attendeeEmail,
      day: moment(apt.day).tz(timezone).format('YYYY-MM-DD'),
      startTime: moment(apt.startTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      endTime: moment(apt.endTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      status: apt.status
    }));

    res.json(formattedOverlaps);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.findOverlapByDate = async (req, res) => {
  try {
    const { email1, email2, date, timezone } = req.query;

    // Validate input
    if (!email1 || !email2 || !date || !timezone) {
      return res.status(400).json({ message: 'Both emails, date, and timezone are required' });
    }

    // Find users
    const [user1, user2] = await Promise.all([
      User.findOne({ email: email1 }),
      User.findOne({ email: email2 })
    ]);

    if (!user1 || !user2) {
      return res.status(404).json({ message: 'One or both users not found' });
    }

    // Convert date to UTC
    const dateUTC = moment.tz(date, timezone).startOf('day').utc().toDate();

    // Fetch appointments for both users for the specific date
    const [user1Appointments, user2Appointments] = await Promise.all([
      Appointment.find({
        $or: [{ host: user1._id }, { attendee: user1._id }],
        day: dateUTC,
        status: 'confirmed'  // Only consider confirmed appointments
      }),
      Appointment.find({
        $or: [{ host: user2._id }, { attendee: user2._id }],
        day: dateUTC,
        status: 'confirmed'  // Only consider confirmed appointments
      })
    ]);

    // Find overlapping appointments
    const overlappingAppointments = [];

    for (const apt1 of user1Appointments) {
      for (const apt2 of user2Appointments) {
        if (apt1._id.equals(apt2._id)) {
          // This is the same appointment, both users are involved
          overlappingAppointments.push(apt1);
        }
      }
    }

    // Format the overlapping appointments
    const formattedOverlaps = overlappingAppointments.map(apt => ({
      _id: apt._id,
      host: apt.hostEmail,
      attendee: apt.attendeeEmail,
      day: moment(apt.day).tz(timezone).format('YYYY-MM-DD'),
      startTime: moment(apt.startTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      endTime: moment(apt.endTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
      status: apt.status
    }));

    res.json(formattedOverlaps);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};