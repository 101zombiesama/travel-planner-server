const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const session = require('cookie-session');
const passport = require('passport');

const passportSetup = require('./services/passportSetup');
const authRouter = require('./routes/authRouter');

const app = express();

app.use(session({
    maxAge: 24*60*60*1000,
    keys: [process.env.COOKIE_KEY]
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DB_URI, () => {
    console.log("connected to the database!");
});

// get home page
app.get('/', (req, res) => {
    res.send("THE SERVER IS RUNNING 😊🏃‍♀️🏃‍♀️💨");
});

// auth routes
app.use('/auth', authRouter);

app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`)
});
