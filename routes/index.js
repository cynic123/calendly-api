var express = require('express');
var router = express.Router();
const { createUser, getUser, updateUser, deleteUser } = require('../controllers/userController');
const { setAvailability, getAvailabilityByDate, getAvailabilityByRange } = require('../controllers/availabilityController');
const { bookAppointment, getAppointmentsByDate, getAppointmentsByRange, cancelAppointment, rescheduleAppointment, findOverlapByRange, findOverlapByDate } = require('../controllers/appointmentController');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Calendly-API' });
});

// User routes
router.post('/users/create', createUser);
router.get('/users/:id', getUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Availability routes
router.post('/availability/', setAvailability);
router.get('/availability/date/:email', getAvailabilityByDate);
router.get('/availability/range/:email', getAvailabilityByRange);

// Appointment routes
router.get('/appointments/overlap/range', findOverlapByRange);
router.get('/appointments/overlap/date', findOverlapByDate);
router.post('/appointments', bookAppointment);
router.get('/appointments/date', getAppointmentsByDate)
router.get('/appointments/range', getAppointmentsByRange);
router.put('/appointments/:appointmentId/cancel', cancelAppointment);
router.put('/appointments/:appointmentId/reschedule', rescheduleAppointment);

module.exports = router;
