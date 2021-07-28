const { compareSync } = require("bcryptjs");
const moment = require('moment');
const request = require('request');
const crypto = require('crypto');
const userServices = require("../services/userServices");
const blockchainServices = require("../services/blockchainServices");
const { mail } = require('../helper/mailer');
const { calculateHours } = require('../helper/userHelper');
const { balanceMainBNB, coinBalanceBNB } = require('../helper/bscHelper');
const { balanceMainETH, coinBalanceETH } = require('../helper/ethHelper');

const sessionHeader = async (req, res, next) => {
    res.locals.session = req.session;
    let user_id = res.locals.session.re_us_id;
    let result = userServices.checkUserId(user_id);
    if (result) {
        res.locals.greet = function () {
            return result;
        }
        res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
        next();
    }
    else {
        return null;
    }
}

const logout = async (req, res) => {
    req.session.destroy();
    res.redirect('/login');
}

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

const signupPage = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    let ref_link = "";
    if (req.body.ref_link != "" && req.body.ref_link != undefined) {
        ref_link = req.body.ref_link.trim();
    }
    let test = req.session.is_user_logged_in;
    if (test == true) {
        res.redirect('/dashboard');
    } else {
        if (req.query.code) {
            res.render('front/signup', { err_msg, success_msg, layout: false, session: req.session, ref_link: req.query.code });
        } else {
            res.render('front/signup', { err_msg, success_msg, layout: false, session: req.session, ref_link: '' });
        }
    }

}

const loginPage = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    let test = req.session.is_user_logged_in;
    if (test == true) {
        res.redirect('/dashboard');
    }
    else {
        res.render('front/login', { err_msg, success_msg, layout: false, session: req.session });
    }
}

const forgotPage = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    var test = req.session.is_user_logged_in;
    if (test == true) {
        res.redirect('/dashboard');
    }
    else {
        res.render('front/forgot-pass', { err_msg, success_msg, layout: false, session: req.session, });
    }
}

const verifyPage = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    var test = req.session.is_user_logged_in;
    if (test == true) {
        res.redirect('/dashboard');
    } else {
        res.render('front/verify-account', { err_msg, success_msg, layout: false, session: req.session })
    }
}

const submitForgot = async (req, res) => {
    let user = await userServices.checkUser(req.body.email);
    if (!user) {
        req.flash('err_msg', 'Please enter registered Email address.');
        res.redirect('/Forgot-password');
    }
    else {
        let new_pass = Math.random().toString(36).slice(-5);
        let mystr1 = await userServices.createCipher(new_pass);
        let status = await userServices.updateARTPass(email, new_pass);
        console.log(status);
        if(status == 1){
            let userUpdated = await userServices.updateUserPassword(req.body.email, mystr1);
            if (userUpdated) {
                let subject = 'OTP for changing password.'
                let text = 'Hello '+ req.body.email + ',<br><br>\n\n' +
                    'Your new password after change password request is: <strong>' + new_pass +
                    '</strong><br><br>\n\n' + 'Please login with this details and set a strong password.<br><br>\n\n' + 
                    'If this password change attempt was not made by you it means someone visited your account. It may be an indication you have been the target of a phishing attempt and might want to consider moving your funds to a new wallet.' + '<br><br>\n\n' + 'Regards,<br>\nTeam THEARTW<br>\nhttps://theartwcoin.com';
                await mail(req.body.email, subject, text);
                req.flash('success_msg', 'Password has been sent successfully to your registered email.');
                res.redirect('/Forgot-password');
            }
            else {
                req.flash('err_msg', 'Something went wrong.');
                res.redirect('/Forgot-password');
            }
        }
        else{
            req.flash('err_msg', 'Something went wrong.');
            res.redirect('/Forgot-password');
        }
    }
}

const submitUser = async (req, res) => {
    if(req.body['g-recaptcha-response'] == undefined || req.body['g-recaptcha-response'] == '' || req.body['g-recaptcha-response'] == null){
        req.flash('err_msg', 'Please select captcha first.');
        res.redirect('/Signup');
    }
    else{
        const secretKey = "6LcQx_AaAAAAAJmTY794kuLiHyURsR_uu-4Wqixg";

        const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response=" + req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;
    
        request(verificationURL, async function(error, response, body2) {
            let body = JSON.parse(body2);
    
            if(error && !body.success) {
                req.flash('err_msg', 'Failed captcha verification.');
                res.redirect('/Signup');
            }else{
                let user = await userServices.checkUser(req.body.email);
                if (user) {
                    req.flash('err_msg', 'Email already exists. Please enter another email.');
                    res.redirect('/Signup');
                }
                else {
                    console.log(req.body.ref_link, '===========req.body.ref_link');
                    let ref_link;
                    if (req.body.ref_link != "" && req.body.ref_link != undefined) {
                        ref_link = req.body.ref_link.trim();
                    } else {
                        ref_link = "";
                    }
                    if (req.body.password == req.body.conf_pass) {
                        let mystr = await userServices.createCipher(req.body.password);
                        let created = await userServices.createAtTimer();
                        await userServices.addUser(req.body, ref_link, mystr, created, 'pending');
                        let user = await userServices.checkUser(req.body.email);
                        if (ref_link != "") {
                            let refData = await userServices.referData(user.ref_code, ref_link, user._id, created);
                        }
                        req.session.success = true;
                        req.session.re_us_id = user._id;
                        req.session.re_usr_name = user.name;
                        req.session.re_usr_email = user.email;
                        req.session.is_user_logged_in = false;
                        let otp = user.otp;
                        let subject = 'OTP for your new account on TheARTW website';
                        let text = 'Hello '+ req.body.email + ',<br><br>\n\nCongratulations on signing up with TheARTW website!<br><br>\n\n' +
                        'Your one-time password (OTP) for signing up is: <strong>' + otp +  '</strong>. This would be valid only for the next 10 minutes.' +
                        '<br><br>\n\nOnce you enter the OTP and create a new wallet, we will credit it by 10 ARTW (worth US$10)  as a limited-time joining bonus.<br><br>\n\n' + 
                        'Moreover, you can earn more by referring your friends and earn US$5 equivalent ARTW tokens every time your friend joins by using your referral code. Your friend will also get US$5 equivalent ARTW tokens for using your referral code !<br><br>\n\n' +
                        'Time: ' + created + '<br><br>\n\n'
                        'If this withdrawal attempt was not made by you it means someone visited your account. It may be an indication you have been the target of a phishing attempt and might want to consider moving your funds to a new wallet.' + '<br><br>\n\n' + 'Regards,<br>\nTeam THEARTW<br>\nhttps://theartwcoin.com';
                        await mail(req.body.email, subject, text);
                        req.flash('success_msg', 'User registered. Please verify to continue.');
                        res.redirect('/Verify_account');
                    }
                    else {
                        req.flash('err_msg', 'Password does not match.');
                        res.redirect('/Signup');
                    }
                }
            }
        })
    }
}

const addTwoUser = async (req, res) => {
    let userI = await userServices.checkUser(req.body.email);
    if (userI) {
        let wallet = {success:0,msg:"Email already exists."};
        let wallet_details= JSON.stringify(wallet);
        res.send(wallet_details); 
    }
    else {
        let ref_link;
        if (req.body.ref_link != "" && req.body.ref_link != undefined) {
            ref_link = req.body.ref_link.trim();
        } else {
            ref_link = "";
        }
        if (req.body.password) {
            let mystr = await userServices.createCipher(req.body.password);
            let created = await userServices.createAtTimer();
            await userServices.addUser(req.body, ref_link, mystr, created, 'pending');
            let user = await userServices.checkUser(req.body.email);
            if (ref_link != "") {
                await userServices.referData(user.ref_code, ref_link, user._id, created);
            }
            let wallet = {success:1,msg:"User created.",data:user};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details); 
        }
        else {
            let wallet = {success:0,msg:"No Password provided."};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details); 
        }
    }
}

const userLogin = async (req, res) => {
    let user = await userServices.checkUser(req.body.email);
    let password = req.body.password.trim();
    let mystr = await userServices.createCipher(password);
    if (user) {
        let userLogin = await userServices.checkUserPass(req.body.email.trim(), mystr);
        if (userLogin) {
            let status = userLogin.status;
            let email_status = userLogin.email_verify_status;
            if (status == 'active' && email_status == 'verified') {
                req.session.success = true;
                req.session.re_us_id = userLogin._id;
                req.session.re_usr_name = userLogin.name;
                req.session.re_usr_email = userLogin.email;
                req.session.is_user_logged_in = true;
                res.redirect("/dashboard");
            } else {
                req.flash('err_msg', 'Your account is not verified.');
                res.redirect('/login')
            }
        }
        else {
            req.flash('err_msg', 'The username or password is incorrect.');
            res.redirect('/login');
        }
    }
    else {
        req.flash('err_msg', 'Please enter valid Email address.');
        res.redirect('/login');
    }
            
}

const verifyUser = async (req, res) => {
    let user_otp = req.body.otp;
    let email = req.session.re_usr_email;
    let user = await userServices.checkUser(email);
    if (user) {
        let text = user.password;
        let mykey1 = crypto.createDecipher('aes-128-cbc', 'mypass');
        let mystr1 = mykey1.update(text, 'hex', 'utf8')
        mystr1 += mykey1.final('utf8');
        if (user.otp === user_otp) {
            let status = await userServices.addARTUser(user.email, mystr1, user.name, user.mobile_no);
            console.log(status);
            if(status == 1){
                let userUpdated = await userServices.updateEmailStatus(user._id);
                console.log(userUpdated);
                if (userUpdated) {
                    req.session.is_user_logged_in = true;
                    res.redirect('/dashboard');
                }
                else {
                    req.flash('err_msg', 'Please enter correct secret code.');
                    res.redirect('/Verify_account');
                }
            }
            else {
                req.flash('err_msg', 'Please enter correct secret code.');
                res.redirect('/Verify_account');
            }
        }
    }
    else {
        req.flash('err_msg', 'Something went wrong.');
        res.redirect('/Verify_account');
    }
}

const verifyARTuser = async (req, res) => {
    let email = req.body.email;
    let user = await userServices.checkUser(email);
    if (user) {
        let userUpdated = await userServices.updateEmailStatus(user._id);
        if (userUpdated) {
            let wallet = {success:1,msg:"User verified.",data:user};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details); 
        }
        else {
            let wallet = {success:0,msg:"User not verified."};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details);
        }
    }
    else {
        let wallet = {success:0,msg:"No user found."};
        let wallet_details= JSON.stringify(wallet);
        res.send(wallet_details);
    }
}

const dashboard = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    let wallet_details = "";
    let import_wallet_id = "";
    let rown_bal = "";
    let test = req.session.is_user_logged_in;
    if (test != true) {
        res.redirect('/Login');
    }
    else {
        let user_id = req.session.re_us_id;
        let user = await userServices.checkUserId(user_id);
        let ref_code = user.ref_code;
        let rates = await userServices.getRates();
        let usdValue = rates.usdValue;
        let etherValue = rates.etherValue;
        let btcValue = rates.btcValue;
        let bnbValue = rates.bnbValue;
        let loginwallet = await blockchainServices.importWalletFindId(user_id);
        if (loginwallet) {
            let result = await blockchainServices.userWalletFindId(loginwallet.wallet_id);
            if (result) {
                req.session.wallet = true;
                let wallet_creation = result.created_at;
                let today = await userServices.createAtTimer();
                let wallet_time_difference = calculateHours(new Date(wallet_creation), new Date(today));
                wallet_details = result;
                import_wallet_id = loginwallet._id;
                let all_transaction = await blockchainServices.findTransactions(wallet_details.wallet_address);
                await blockchainServices.checkTxStatus(all_transaction);
                all_transaction = await blockchainServices.findTransactions(wallet_details.wallet_address);
                let balance = await blockchainServices.getCoinBalance(wallet_details.wallet_address);
                let rown_bal = balance;
                let bnbBalance = await balanceMainBNB(wallet_details.wallet_address);
                let ethBalance = await balanceMainETH(wallet_details.wallet_address);
                let coinbalance = await coinBalanceBNB(wallet_details.wallet_address);
                let usd_value = Math.round(usdValue * coinbalance * 100)/100;
                let usd_actual = (1/parseFloat(usdValue)) * coinbalance;
                let bnb_value = (1/parseFloat(bnbValue)) * bnbBalance;
                let eth_value = (1/parseFloat(etherValue)) * ethBalance;
                let full_value = usd_actual + bnb_value + eth_value;
                full_value = Math.round(full_value * 100)/100;
                res.render('front/dashboard', { err_msg, success_msg, ref_code, wallet_details, usdValue, etherValue, btcValue, bnbValue, import_wallet_id, balance, rown_bal, layout: false, session: req.session, crypto, all_transaction, wallet_time_difference, moment, bnbBalance, coinbalance, usd_value, ethBalance, full_value });
            }
        }
        else {
            // let usd_value = 0;
            // let bnbBalance = 0;
            // let ethBalance = 0;
            // let coinbalance = 0;
            // res.render('front/dashboard', { err_msg, success_msg, ref_code, wallet_details, usdValue, etherValue, btcValue, bnbValue, import_wallet_id, rown_bal, layout: false, session: req.session, crypto, all_transaction: [], coinbalance, bnbBalance, usd_value, ethBalance });
            req.session.wallet = false;
            res.redirect('/Create-wallet-dash');
        }
    }
}

const walletSuccess = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    let wallet_address = "";
    let test = req.session.is_user_logged_in;
    if (test != true) {
        res.redirect('/Login');
    }
    else {
        if (req.query.wallet) {
            wallet_address = Buffer.from(req.query.wallet, 'base64').toString('ascii');
        }
        res.render('front/wallet-success', { err_msg, success_msg, wallet_address, layout: false, session: req.session, });
    }
}

const referral = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    var test = req.session.is_user_logged_in;
    if (test == true) {
        let user_id = req.session.re_us_id;
        let user = await userServices.checkUserId(user_id);
        let ref_code = user.ref_code;
        let referrals = await userServices.findReferData(ref_code);
        res.render('front/referral-table', { err_msg, success_msg, layout: false, session: req.session, ref_code, referrals })
    } else {
        res.redirect('/login');

    }
}

const updateARTuser = async (req, res) => {
    let email = req.body.email;
    let user = await userServices.checkUser(email);
    if(user){
        let name, mob, country;
        if(req.body.name){
            name = req.body.name.trim();
        }
        else{
            name = user.name;
        }
        if(req.body.mob){
            mob = req.body.mob.trim();
        }
        else{
            mob = user.mobile_no;
        }
        if(req.body.country){
            country = req.body.country.trim();
        }
        else{
            country = user.country;
        }
        let userUpdated = await userServices.updateUser(email, name, mob, country);
        if (userUpdated) {
            let wallet = {success:1,msg:"User Updated.",data:userUpdated};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details); 
        }
        else {
            let wallet = {success:0,msg:"User not verified."};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details);
        }
    }
    else{
        let wallet = {success:0,msg:"No user found."};
        let wallet_details= JSON.stringify(wallet);
        res.send(wallet_details);
    }
}

const changeARTpass = async (req, res) => {
    let password = req.body.password;
    let email = req.body.email;
    let user = await userServices.checkUser(email);
    if(user){
        let mystr1 = await userServices.createCipher(password);
        let userUpdated = await userServices.updateUserPassword(email, mystr1);
        if (userUpdated) {
            let wallet = {success:1,msg:"User Password Updated.",data:userUpdated};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details); 
        }
        else {
            let wallet = {success:0,msg:"User not verified."};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details);
        }
    }
    else{
        let wallet = {success:0,msg:"No user found."};
        let wallet_details= JSON.stringify(wallet);
        res.send(wallet_details);
    }    
}

const gettx = async (req, res) => {
    let sender = req.body.sender;
    let txs = await blockchainServices.findTransactions(sender);
    res.send({txs});
}

const gettxdate = async (req, res) => {
    let sender = req.body.sender;
    let txs = await blockchainServices.findTransactionsDate(sender, req.body.date);
    res.send({txs});
}

const getrefdate = async (req, res) => {
    let code = req.body.code;
    let txs = await userServices.findReferDataDate(code, req.body.date);
    res.send({txs});
}

const getrefemail = async (req, res) => {
    let code = req.body.code;
    let txs = await userServices.findReferDataEmail(code);
    res.send({txs});
}

const getusers = async (req, res) => {
    let pass = req.body.pass;
    if(pass == 'Pawan@Quest'){
        let users = await userServices.findUserData();
        res.send({users});
    }
}

module.exports = {
    sessionHeader,
    logout,
    landingPage,
    signupPage,
    loginPage,
    forgotPage,
    verifyPage,
    submitForgot,
    submitUser,
    addTwoUser,
    userLogin,
    verifyUser,
    verifyARTuser,
    dashboard,
    walletSuccess,
    referral,
    updateARTuser,
    changeARTpass,
    gettx,
    gettxdate,
    getrefdate,
    getrefemail,
    getusers
};
