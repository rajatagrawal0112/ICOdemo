var express = require('express');
var router = express.Router();
const fs = require('fs');
const crypto = require('crypto');
const auth = require('../config/auth');
const qr = require('qr-image');
const Tx = require('ethereumjs-tx');
const speakeasy = require('speakeasy');
const moment = require('moment');
const userServices = require("../services/userServices");
const userControllers = require('../controllers/userControllers');
const blockchainController = require('../controllers/blockchainController');
const blockchainServices = require("../services/blockchainServices");
// const { balanceMainBNB, coinBalanceBNB } = require('../helper/bscHelper');
// const { balanceMainETH } = require('../helper/ethHelper');
const { mail } = require('../helper/mailer');

const { Registration, Userwallet, Importwallet, Tokensettings, Tokendetails, OrderDetails, RefCode, FAQ, ContactInfo } = require('../models/contact');

var isUser = auth.isUser;

//***************** get landing page **************//
router.get('/', userControllers.landingPage);


module.exports = router;
