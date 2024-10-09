# Calendly API

This project is a RESTful API that provides functionality similar to Calendly, allowing users to manage their availability and schedule appointments.

## Features

- User management
- Availability management
- Appointment scheduling
- Appointment rescheduling and cancellation
- Overlap finding between users' appointments
- Timezone handling - a bunch of APIs related to availability and appointments are expected to have user timezone in the request so that responses are provided on the basis of the same. 

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or above)
- [MongoDB](https://www.mongodb.com/) (v7 or above)

## Project Setup
1. Clone the repository:
   ```
   git clone https://github.com/cynic123/calendly-api.git
   ```

2. Navigate to the project directory:
   ```
   cd calendly-api
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Create a `.env` file in the root directory and add your application port and MongoDB connection string:
   ```
   PORT=your_app_port
   ```

   ```
   MONGODB_URI=your_mongodb_connection_string (e.g. mongodb://localhost:27017/calendly)
   ```

5. Start the server:
   ```
   npm start
   ```

## API Endpoints

### User Routes

- `POST /users/create`: Create a new user
  ```bash
  curl --location 'http://localhost:9090/users/create' \
   --header 'Content-Type: application/json' \
   --data-raw '{
    "name": "Hope Works",
    "email": "hopeworks@gmail.com"
  }'
  ```
- `GET /users/:id`: Get user details
  ```bash
  curl --location 'http://localhost:9090/users/<user_id_here>'
  ```
- `PUT /users/:id`: Update user details
  ```bash
  curl --location --request PUT 'http://localhost:9090/users/<user_id_here>' \
  --header 'Content-Type: application/json' \
  --data-raw '{
      "name": "Hope Works Updated",
      "email": "hopeworks@gmail.com"
  }'
  ```
- `DELETE /users/:id`: Delete a user
  ```bash
  curl --location --request DELETE 'http://localhost:9090/users/<user_id_here>'
  ```

### Availability Routes

- `POST /availability`: Set user availability
  ```bash
  curl --location 'http://localhost:9090/availability/' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "hopeworks@gmail.com",
    "timezone": "Asia/Kolkata",
    "availabilities": [
      {
        "date": "2024-10-23",
        "timeSlots": [
            {
                "start": "12:30",
                "end": "13:30"
            },
            {
                "start": "14:15",
                "end": "15:15"
            }
        ]
      }
    ]
  }'
  ```
- `GET /availability/date/:email`: Get user availability for a specific date
  ```bash
  curl --location 'http://localhost:9090/availability/date/hopeworks@gmail.com?date=2024-10-23&timezone=Asia%2FKolkata'
  ```
- `GET /availability/range/:email`: Get user availability for a date range
  ```bash
  curl --location 'http://localhost:9090/availability/range/hopeworks@gmail.com?startDate=2024-10-15&endDate=2024-10-25&timezone=Asia%2FKolkata'
  ```

### Appointment Routes

- `POST /appointments`: Book an appointment
  ```bash
  curl --location 'http://localhost:9090/appointments' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "hostEmail": "sofarsogood@gmail.com",
    "attendeeEmail": "hopeworks@gmail.com",
    "startTime": "2024-10-23 12:30",
    "endTime": "2024-10-23 13:00",
    "timezone": "Asia/Kolkata"
  }'
  ```
- `GET /appointments/date`: Get appointments for a specific date
  ```bash
  curl --location 'http://localhost:9090/appointments/date?email=sofarsogood%40gmail.com&date=2024-10-23&timezone=Asia%2FKolkata'
  ```
- `GET /appointments/range`: Get appointments for a date range
  ```bash
  curl --location 'http://localhost:9090/appointments/range?email=sofarsogood%40gmail.com&startDate=2024-10-15&endDate=2024-10-25&timezone=Asia%2FKolkata'
  ```
- `PUT /appointments/:appointmentId/cancel`: Cancel an appointment
  ```bash
  curl --location --request PUT 'http://localhost:9090/appointments/<appointment_id_here>/cancel' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "sofarsogood@gmail.com",
    "timezone": "Asia/Kolkata"
  }'
  ```
- `PUT /appointments/:appointmentId/reschedule`: Reschedule an appointment
  ```bash
  curl --location --request PUT 'http://localhost:9090/appointments/<appointment_id_here>/reschedule' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "sofarsogood@gmail.com",
    "newStartTime": "2024-10-23 14:30",
    "newEndTime": "2024-10-23 15:00",
    "timezone": "Asia/Kolkata"
  }'
  ```
- `POST /appointments/overlap/range`: Find overlapping appointments in a date range
  ```bash
  curl --location 'http://localhost:9090/appointments/overlap/date?email1=sofarsogood%40gmail.com&email2=hopeitisworking%40gmail.com&date=2024-10-23&timezone=Asia%2FKolkata'
  ```
- `POST /appointments/overlap/date`: Find overlapping appointments for a specific date
  ```bash
  curl --location 'http://localhost:9090/appointments/overlap/range?email1=sofarsogood%40gmail.com&email2=hopeitisworking%40gmail.com&startDate=2024-10-15&endDate=2024-10-31&timezone=Asia%2FKolkata'
  ```
## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.


