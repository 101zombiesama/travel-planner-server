const router = require('express').Router();
const passport = require('passport');

router.get('/login', (req, res) => {
    res.send("This is the Login Page 🔑")
});

router.get('/logout', (req, res) => {
    req.logOut();
    res.send("You have been logged out! 🤦‍♂️")
});

// Google OAuth
router.get('/google',passport.authenticate("google", {
    scope: ['profile']
}));
// Redirect for Google OAuth
router.get('/google/redirect', passport.authenticate("google"), (req, res) => {
    res.send(req.user);
});



// facebook OAuth
router.get('/facebook', passport.authenticate("facebook"));
// redirect for facebook OAuth
router.get('/facebook/redirect', passport.authenticate("facebook"), (req, res) => {
    res.send(req.user);
});

module.exports = router;