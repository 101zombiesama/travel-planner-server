const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const session = require('cookie-session');
const passport = require('passport');
const sgMail = require('@sendgrid/mail');
const cors = require('cors');

const User = require('./models/User');

const passportSetup = require('./services/passportSetup');

// const auth = require('./api/auth');

const app = express();

app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

app.use(session({
    maxAge: 24*60*60*1000,
    keys: [process.env.COOKIE_KEY]
}));

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DB_URI, () => {
    console.log("connected to the database!");

});

// get home page
app.get('/', (req, res) => {
    res.send("THE SERVER IS RUNNING 😊🏃‍♀️🏃‍♀️💨");
});

// api routes
app.use('/api', require('./api'));
app.get('/test', (req, res) => {
    setTimeout(()=> {
        res.send('heloooo')
    }, 5000);
});

app.use((req, res, next) => {
    const error = new Error('Not found');
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    res.status(error.status || 500);
    if(error.status == 404) {
        res.send({ msg: "404: NOT FOUND" })
    } else {
        res.send({ msg: "500: INTERNAL ERROR" });
    }
})

app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`)
});
