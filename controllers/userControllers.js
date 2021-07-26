const moment = require('moment');
const crypto = require('crypto');
const userServices = require("../services/userServices");
const blockchainServices = require("../services/blockchainServices");
const { mail } = require('../helper/mailer');
const { calculateHours } = require('../helper/userHelper');

const landingPage = async (req, res) => {
    let rates = await userServices.getRates();
    if (rates) {
        res.render('front/index', {
            token_values: rates
        });
    }
    else {
        res.render('front/comingsoon');
    }
}

module.exports = {
    landingPage
}