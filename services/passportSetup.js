const passport = require('passport');
const randomstring = require('randomstring');
const GoogleStrategy = require('passport-google-oauth20');
const LocalStrategy = require('passport-local');
const User = require('../models/User');

passport.serializeUser((user, done) => {
    // serializes the user into a encrypted id and attaches to cookie while sending to client
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // deserializes the id to get a decrypted userId i.e id, finds the user with that id and user object is avaliable on req
    User.findById(id).then((user) => {
        done(null, user.id);
    }).catch(err => {
        console.log(err);
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

        User.findOne({ email: profile._json.email })
        .then((existinUser) => {
            if (existinUser) {
                console.log("user already exists");
                // user already signed up
                done(null, existinUser);
            }
            else {
                console.log("registering new user");
                // create unique username from email
                const prefix = profile._json.email.split('@')[0];
                const suffix = randomstring.generate(6);
                const username = prefix + '_' + suffix;
                // register the user
                new User({
                    email: profile._json.email,
                    name: profile._json.name,
                    profilePicture: profile._json.picture,
                    emailVerified: true,
                    username: username
                })
                .save()
                .then((user) => {
                    console.log(`new user registered: ${user.name}`);
                    done(null, user); 
                }).catch(err => {
                    console.log(err);
                });
            }
        })
    })
);

// facebook strategy
passport.use(new LocalStrategy(
    (email, password, done) => {
      User.findOne({ email: email },  (err, user) => {
        if (err) { return done(err); }
        if (!user) { return done(null, false); }
        if (!user.verifyPassword(password)) { return done(null, false); }
        return done(null, user);
      });
    }
  ));