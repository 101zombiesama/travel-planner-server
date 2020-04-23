const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/places', require('./places'));

module.exports = router;