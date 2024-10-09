const User = require('../models/User');
const Availability = require('../models/Availability');
const moment = require('moment-timezone');

exports.setAvailability = async (req, res) => {
  try {
    const { email, availabilities, timezone } = req.body;

    if (!email || !timezone) {
      return res.status(400).json({ message: 'Email and timezone are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert availabilities to UTC Date objects
    const convertedAvailabilities = availabilities.map(avail => ({
      date: moment.tz(`${avail.date}`, timezone).utc().toDate(),
      timeSlots: avail.timeSlots.map(slot => ({
        start: moment.tz(`${avail.date} ${slot.start}`, timezone).utc().toDate(),
        end: moment.tz(`${avail.date} ${slot.end}`, timezone).utc().toDate()
      }))
    }));

    // Update or insert availabilities for each date
    const updatePromises = convertedAvailabilities.map(async (avail) => {
      const existingAvailability = await Availability.findOne({ userId: user._id, date: avail.date });

      if (existingAvailability) {
        // Merge existing time slots with new time slots
        const mergedTimeSlots = [...existingAvailability.timeSlots, ...avail.timeSlots];

        // Optional: You could sort or deduplicate the time slots if necessary
        const sortedTimeSlots = mergedTimeSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

        return Availability.findOneAndUpdate(
          { userId: user._id, date: avail.date },
          { 
            $set: { 
              userId: user._id, 
              date: avail.date, 
              timeSlots: sortedTimeSlots // Merge with existing time slots
            } 
          },
          { new: true }
        );
      } else {
        // If no availability exists for the day, insert a new one
        return Availability.findOneAndUpdate(
          { userId: user._id, date: avail.date },
          { 
            $set: { 
              userId: user._id, 
              date: avail.date, 
              timeSlots: avail.timeSlots 
            } 
          },
          { upsert: true, new: true }
        );
      }
    });

    const updatedAvailabilities = await Promise.all(updatePromises);

    // Convert the results back to the requested timezone and format
    const formattedAvailabilities = updatedAvailabilities.map(avail => ({
      date: moment(avail.date).tz(timezone).format('YYYY-MM-DD'),
      timeSlots: avail.timeSlots.map(slot => ({
        start: moment(slot.start).tz(timezone).format('HH:mm'),
        end: moment(slot.end).tz(timezone).format('HH:mm')
      }))
    }));

    res.json({
      message: 'Availabilities set successfully',
      availabilities: formattedAvailabilities
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAvailabilityByRange = async (req, res) => {
  try {
    const { email } = req.params;
    const { startDate, endDate, timezone } = req.query;

    if (!email || !timezone || !startDate || !endDate) {
      return res.status(400).json({ message: 'Email, timezone, startDate, and endDate are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const startUTC = moment.tz(startDate, timezone).utc().startOf('day').toDate();
    const endUTC = moment.tz(endDate, timezone).utc().endOf('day').toDate();

    const availabilities = await Availability.find({
      userId: user._id,
      date: { $gte: startUTC, $lte: endUTC }
    }).sort('date');

    const formattedAvailabilities = availabilities.map(avail => ({
      date: moment(avail.date).tz(timezone).format('YYYY-MM-DD'),
      timeSlots: avail.timeSlots.map(slot => ({
        start: moment(slot.start).tz(timezone).format('HH:mm'),
        end: moment(slot.end).tz(timezone).format('HH:mm')
      }))
    }));

    res.json(formattedAvailabilities);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAvailabilityByDate = async (req, res) => {
  try {
    const { email } = req.params;
    const { date, timezone } = req.query;

    if (!email || !timezone || !date) {
      return res.status(400).json({ message: 'Email, timezone, and date are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const dateUTC = moment.tz(date, timezone).startOf('day').utc().toDate();

    const availability = await Availability.findOne({
      userId: user._id,
      date: dateUTC
    });

    if (!availability) {
      return res.json({ date: moment(dateUTC).tz(timezone).format('YYYY-MM-DD'), timeSlots: [] });
    }

    const formattedAvailability = {
      date: moment(availability.date).tz(timezone).format('YYYY-MM-DD'),
      timeSlots: availability.timeSlots.map(slot => ({
        start: moment(slot.start).tz(timezone).format('HH:mm'),
        end: moment(slot.end).tz(timezone).format('HH:mm')
      }))
    };

    res.json(formattedAvailability);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};