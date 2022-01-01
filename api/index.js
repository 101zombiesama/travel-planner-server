const router = require('express').Router();
const { checkSignedIn } = require('../helpers');

router.use('/auth', require('./auth'));
router.use('/places', checkSignedIn, require('./places'));
router.use('/trips', checkSignedIn, require('./trips'));
router.use('/gplaces', require('./gplaces'));

module.exports = router;