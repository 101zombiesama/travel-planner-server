const router = require('express').Router();
const passport = require('passport');
const User = require('../models/User');
const randomstring = require('randomstring');

const { sendVerificationMail } = require('../helpers');

router.post('/signup', (req, res, next) => {
    const { email, username, password } = req.body;
    // check if account already exists
    User.findOne({ $or:[ { email: email }, { username: username } ] }, async (err, user) => {
        if (err) {
            console.log(err);
            next(err);
        }
        else if (user) {
            res.status(409).send({ msg: "AUTH_SIGNUP_FAIL_CONFLICT" });
        } else {
            // create account
            const newUser = new User();
            newUser.username = username;
            newUser.email = email;
            newUser.role = 'USER';
            newUser.password = newUser.hashPassword(password);
            newUser.emailVerified = false;
            newUser.emailVerificationToken = randomstring.generate(20);
            newUser.save()
                    .then(user => {
                        // send email for verification with verification link. /auth/signup/verify?userId=${userId}&t=${token}
                        // ............. //
                        sendVerificationMail(user.email, user.emailVerificationToken);
                        res.status(200).send({ msg: "AUTH_SIGNUP_SUCCESS" });
                    }).catch(err => {
                        console.log(err)
                        next(err);
                    });
        
        }

    })
});

// verification route
router.get('/signup/verify', async (req, res) => {
    
    const token = req.query.t;

    // find user with token
    const user = await User.findOne({ emailVerificationToken: token });
    if(user) {
        user.emailVerificationToken = "";
        user.emailVerified = true;
        await user.save();
        res.status(200).send({ msg: "AUTH_SIGNUP_VERIFY_SUCCESS" });
    } else {
        res.status(400).send({ msg: "AUTH_SIGNUP_VERIFY_FAIL" });
    }

});


router.post('/signin', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(401).send(info);
        }
        req.logIn(user, function (err) {
            if (err) {
                return next(err);
            }
            return res.status(200).send({ msg: "AUTH_SIGNIN_SUCCESS" });
        });
    })(req, res, next);
});

router.get('/signout', (req, res) => {
    if (!req.user) {
        return res.status(400).send({ msg: "AUTH_SIGNOUT_FAIL_NOTSIGNEDIN" });
    }
    req.logOut();
    res.status(200).send({ msg: "AUTH_SIGNOUT_SUCCESS" });
});

// Google OAuth
router.get('/google',passport.authenticate("google", {
    scope: ['profile', 'email']
}));
// Redirect for Google OAuth
router.get('/google/redirect', passport.authenticate("google"), (req, res) => {
    // res.send(req.user);
    res.status(200).send({ msg: "AUTH_SIGNIN_GOOGLE_SUCCESS" });
});

module.exports = router;