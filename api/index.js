const router = require('express').Router();
const { checkSignedIn } = require('../helpers');

router.use('/auth', require('./auth'));
router.use('/places', checkSignedIn, require('./places'));

module.exports = router;