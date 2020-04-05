const passport = require('passport');
const randomstring = require('randomstring');
const GoogleStrategy = require('passport-google-oauth20');
const LocalStrategy = require('passport-local');
const User = require('../models/User');

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// google strategy
passport.use(
    new GoogleStrategy({

        callbackURL: '/api/auth/google/redirect',
        clientID: process.env.GOOGLE_CLIENTID,
        clientSecret: process.env.GOOGLE_CLIENTSECRET

    }, async (accessToken, refreshToken, profile, done) => {

        // passport callback function

        const existingUser = await User.findOne({ email: profile._json.email })
        
        if (existingUser) {
            console.log("user already exists");
            // user already signed up
            done(null, existingUser);
        }
        else {
            console.log("registering new user");
            // create unique username from email
            const prefix = profile._json.email.split('@')[0];

            const user = await User.findOne({ username: prefix });
            var username = String;
            if (user) {
                const suffix = randomstring.generate(6);
                username = prefix + '_' + suffix;
            } else {
                username = prefix;
            }
            // register the user
            new User({
                email: profile._json.email,
                name: profile._json.name,
                profilePicture: profile._json.picture,
                emailVerified: true,
                username: username,
                role: 'USER'
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
);

// facebook strategy
passport.use(new LocalStrategy(
    async (username, password, done) => {

        // check if the username is username or password by looking for @
        const user = await User.findOne({ $or: [ { email: username }, { username: username } ] });
        if (!user) return done(null, false, { msg: "AUTH_SIGNIN_FAIL_INVALID_UsernotFound" });
        if (!user.comparePassword(password, user.password)) {
            console.log("wrong password")
            return done(null, false, { msg: "AUTH_SIGNIN_FAIL_INVALID" });
        }
        if (!user.emailVerified) {
            console.log("email not verified")
            return done(null, false, { msg: "AUTH_SIGNIN_FAIL_UNVERIFIED" });
        }
        return done(null, user);
   
    }
));