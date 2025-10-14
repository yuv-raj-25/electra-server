import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import userRouter from './routes/user.routes.js';
import stationRouter from './routes/station.routes.js';
import adminActivityRouter from './routes/adminActivity.routes.js';
import bookingRouter from './routes/booking.routes.js';
import chargingSessionRouter from './routes/chargingSession.routes.js';
import paymentRouter from './routes/payment.routes.js';

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))
app.use(express.json({limit: '16kb'}));
app.use(express.urlencoded({ extended: true  , limit: '16kb'}));
app.use(express.static('public'));
app.use(cookieParser());


app.get("/" , (req, res) => {
    res.send("Welcome to Electra API")
})



// user routes
app.use("/api/v2/users" , userRouter);

// station routes
app.use("/api/v2/stations" , stationRouter);

// admin activity routes 
app.use("/api/v2/admin/activities" , adminActivityRouter);

// booking routes
app.use("/api/v2/bookings" , bookingRouter);

// charging session routes
app.use("/api/v2/charging-sessions" , chargingSessionRouter);

// payment routes
app.use("/api/v2/payments" , paymentRouter);



export { app };