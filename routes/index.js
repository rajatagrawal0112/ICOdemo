const { Router } = require('express');
const router = Router();
const crypto = require('crypto');
const session = require('express-session');
const front = require('./front');
// const admin = require('./admin');
// const phone_apis = require('./android-ios');

router.use(session({ 
  secret: 'admindetails',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000 }
}));

router.use('/', front);
// router.use('/', admin);
// router.use('/', phone_apis);

module.exports = router;
