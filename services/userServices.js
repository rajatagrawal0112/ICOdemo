const moment = require("moment");
const crypto = require('crypto');
const { generateCode } = require('../helper/userHelper');
const { Registration, Userwallet, Importwallet, Tokensettings, Tokendetails, OrderDetails, RefCode, FAQ, ContactInfo } = require('../models/contact');

const getRates = async () => {
    let rates = await Tokensettings.findOne();
    if (rates) {
      return rates;
    }
};

module.exports = {
    getRates
}