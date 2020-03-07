const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20');
const FacebookStrategy = require('passport-facebook');
const User = require('../models/User');

passport.serializeUser((user, done) => {
    // serializes the user into a encrypted id and attaches to cookie while sending to client
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // deserializes the id to get a decrypted userId i.e id, finds the user with that id and user object is avaliable on req
    User.findById(id).then((user) => {
        done(null, user.id);
    });
});

// google strategy
passport.use(
    new GoogleStrategy({

        callbackURL: '/auth/google/redirect',
        clientID: process.env.GOOGLE_CLIENTID,
        clientSecret: process.env.GOOGLE_CLIENTSECRET

    }, (accessToken, refreshToken, profile, done) => {
        // passport callback function
        User.findOne({ googleId: profile.id }).then((existinUser) => {
            if (existinUser) {
                console.log("user already exists")
                // user already signed up
                done(null, existinUser);
            }
            else {
                console.log("registering new user")
                // register the user
                new User({
                    googleId: profile.id,
                    displayName: profile.displayName
                }).save().then((user) => {
                    console.log(`new user registered: ${user.displayName}`);
                    done(null, user);
                });
            }
        })
    })
);

// facebook strategy
passport.use(
    new FacebookStrategy({

        callbackURL: '/auth/facebook/redirect',
        clientID: process.env.FB_CLIENTID,
        clientSecret: process.env.FB_CLIENTSECRET

    }, (accessToken, refreshToken, profile, done) => {
        // passport callback function
        User.findOne({ facebookId: profile.id }).then((existinUser) => {
            if (existinUser) {
                console.log("user already exists")
                // user already signed up
                done(null, existinUser);
            }
            else {
                console.log("registering new user")
                // register the user
                new User({
                    facebookId: profile.id,
                    displayName: profile.displayName
                }).save().then((user) => {
                    console.log(`new user registered: ${user.displayName}`);
                    done(null, user);
                });
            }
        })
    })
);