const { compareSync } = require("bcryptjs");
const userServices = require("../services/userServices");
const blockchainServices = require("../services/blockchainServices");
const { mail } = require('../helper/mailer');
const { balanceMainBNB, coinBalanceBNB, BNBTransfer, CoinTransfer, AdminCoinTransfer } = require('../helper/bscHelper');
const { balanceMainETH, ETHTransfer } = require('../helper/ethHelper');

const signupReward = '10';
const referReward = '5';
const coinFees = '1';
const adminAddress = process.env.ADMIN;

const createWallet = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    let passphrase = "";
    let test = req.session.is_user_logged_in;
    if (test != true) {
        res.redirect('/login');
    }
    else {
        let passphraseNew = await blockchainServices.createWallet();
        if (passphraseNew) {
            passphrase = passphraseNew;
        }
        res.render('front/dash-private-key', { err_msg, success_msg, passphrase, layout: false, session: req.session });
    }
}

const verifyWallet = async (req, res) => {
    let user_passphrase = req.body.passphrase;
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    let test = req.session.is_user_logged_in;
    if (test != true) {
        res.redirect('/Login');
    } else {
        res.render('front/verify-private-key', { err_msg, success_msg, user_passphrase, layout: false, session: req.session });
    }
}

const submitWallet = async (req, res) => {
    let user_id = req.session.re_us_id;
    let user_passphrase = req.body.passphrase.trim();
    let check_passphrase = req.body.check_key.trim();
    let hash = await blockchainServices.createHash(user_passphrase);
    if (user_passphrase == check_passphrase) {
        let created = await userServices.createAtTimer();
        let address = await blockchainServices.checkWalletPrivate(user_passphrase);
        let dummyUser = await userServices.checkUserId(user_id);
        // let status = await blockchainServices.addARTwallet(dummyUser.email, address);
        // console.log(status);
        // if(status == 1){
            let UserwalletData = await blockchainServices.userWalletEntry(user_id, address, hash, created);
            if (UserwalletData) {
                let walletData = blockchainServices.userWalletFindWallet(address);
                let user = await userServices.checkUserId(user_id);
                let sendReward = parseInt(signupReward);
                if(user.ref_from){
                //     // let hashObject = await AdminCoinTransfer(address, referReward);
                    sendReward = sendReward + parseInt(referReward);
                //     // let hash = hashObject.transactionHash;
                //     // await blockchainServices.addTransaction(user_id, walletData._id, adminAddress, address, hash, referReward, 'ARTW');
                    let userRefer = await userServices.checkUserReferCode(user.ref_from);
                    let subject = 'Referral bonus credited.'
                    let text = 'Hello '+ user.email + ',<br><br>\n\n' +
                    'Congratulations we have credited your ARTW account by 5 ARTW (worth US$5) as your friend signed up using your referral code!<br><br>\n\n' + 
                    'Earn more ARTW by referring your friends and stand a chance to win exclusive ARTW NFTs !!' + '<br><br>\n\n' + 'Regards,<br>\nTeam THEARTW<br>\nhttps://theartwcoin.com';
                    await mail(user.email, subject, text);
                    let userReferred = await userServices.checkUserWallet(userRefer._id);
                    let referAddress = userReferred.wallet_address;
                    let hashObject2 = await AdminCoinTransfer(referAddress, referReward);
                    let hash2 = hashObject2.transactionHash;
                    await blockchainServices.addTransaction(userRefer._id, userReferred._id, adminAddress, referAddress, hash2, referReward, 'ARTW');
                    if(hashObject2){
                        await userServices.refUpdate(user.ref_code, user.ref_from);
                    }
                }
                let finalSend = sendReward.toString();
                let hashObject3 = await AdminCoinTransfer(address, finalSend);
                console.log(finalSend,'-------------------finalSend',typeof finalSend);
                let hash3 = hashObject3.transactionHash;
                await blockchainServices.addTransaction(user_id, walletData._id, adminAddress, address, hash3, finalSend, 'ARTW');
                let userwallet = await blockchainServices.userWalletFindWallet(address);
                await blockchainServices.importWalletEntry(user_id, userwallet._id, created);
                res.redirect('/Create-wallet-success?wallet=' + Buffer.from(address).toString('base64'));
            }
            else {
                req.flash('err_msg', 'Something went wrong.');
                res.redirect('/Create-wallet-dash');
            }
        // }
        // else {
        //     req.flash('err_msg', 'Something went wrong.');
        //     res.redirect('/Create-wallet-dash');
        // }
    }
    else {
        res.redirect('/verify-key');
    }
}

const sendCoin = async (req, res) => {
    let user_id = req.session.re_us_id;
    let test = req.session.is_user_logged_in;
    let otp = Math.floor(Math.random() * 900000) + 100000;
    let wallet_id = req.body.get_wallet_id.trim();
    // let user_correct_passphrese = req.body.user_cr_pass.trim();
    let entered_passphrese = req.body.passphrase.trim();
    let sender_address = req.body.sender_address.trim();
    let type = req.body.type.trim();
    let reciver_address = req.body.reciver_address.trim();
    let get_amount = req.body.amount_send.trim();
    let hashnew = await blockchainServices.createHash(entered_passphrese);
    if (test != true) {
        res.redirect('/login');
    }
    else {
        let balance = await blockchainServices.getCoinBalance(sender_address);
        if (balance < parseInt(coinFees)){
            req.flash('err_msg', "Insufficient ARTW fees In Your account.");
            res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type);
        }
        if(type == 'eth'){
            balance = await balanceMainETH(sender_address);
        }
        else if(type == 'bnb'){
            balance = await balanceMainBNB(sender_address);
        }
        if (balance >= get_amount) {
            if (hashnew == hashnew) {
                let balance2 = await balanceMainBNB(sender_address);
                if(0.05 > parseInt(balance) && type == 'eth'){
                    req.flash('err_msg', 'Do not have fees to propose this transaction.');
                    res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type);
                }
                else if(0.01 > parseInt(balance) && type == 'bnb'){
                    req.flash('err_msg', 'Do not have fees to propose this transaction.');
                    res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type);
                }
                else if(0.01 > parseInt(balance2) && type == 'artw'){
                    req.flash('err_msg', 'Do not have fees to propose this transaction.');
                    res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type);
                }
                else{
                    var send_obj = {
                        type: type,
                        sender_address: sender_address,
                        get_amount: get_amount,
                        reciver_address: reciver_address,
                        sender_private_key: entered_passphrese,
                        wallet_id: wallet_id
                    }
                    req.session.send_obj = send_obj;
                    await userServices.updateUserOTP(user_id, otp);
                    let subject = 'OTP for withdrawing funds.'
                    let text = 'Hello '+ req.session.re_usr_email + ',<br><br>\n\n' +
                        'Your one-time password (OTP) for withdrawal is: <strong>' + otp +
                        '</strong><br><br>\n\n' + 'This would be valid for only for the next 10 minutes<br><br>\n\n' + 
                        'If this withdrawal attempt was not made by you it means someone visited your account. It may be an indication you have been the target of a phishing attempt and might want to consider moving your funds to a new wallet.' + '<br><br>\n\n' + 'Regards,<br>\nTeam THEARTW<br>\nhttps://theartwcoin.com';
                    await mail(req.session.re_usr_email, subject, text);
                    res.redirect('/verify_2fa');
                }
            }
            else {
                req.flash('err_msg', 'Please enter valid passphrase.');
                res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type);
            }
        }
        else {
            req.flash('err_msg', "Insufficient "+type+" In Your account.");
            res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type);
        }
    }
}

const verify2fa = async (req, res) => {
    let err_msg = req.flash('err_msg');
    let success_msg = req.flash('success_msg');
    res.render('front/verify-2fa', { err_msg, success_msg, layout: false, session: req.session });
}

const send2fa = async (req, res) => {
    let user_otp = req.body.otp;
    let email = req.session.re_usr_email;
    let result = await userServices.checkUser(email);
    if (result) {
        if (result.otp === user_otp) {
            let user_id = req.session.re_us_id;
            let send_obj = req.session.send_obj;
            let wallet_id = send_obj.wallet_id;
            let type = send_obj.type;
            let sender_address = send_obj.sender_address;
            let get_amount = send_obj.get_amount;
            let reciver_address = send_obj.reciver_address;
            let sender_private_key = send_obj.sender_private_key;
            let hashObject;
            if(type == 'eth'){
                hashObject = await ETHTransfer(reciver_address, get_amount, sender_address, sender_private_key);
                await CoinTransfer(adminAddress, coinFees, sender_address, sender_private_key);
                type = 'ETH';
            }
            else if(type == 'bnb'){
                hashObject = await BNBTransfer(reciver_address, get_amount, sender_address, sender_private_key);
                let hashObject2 = await CoinTransfer(adminAddress, coinFees, sender_address, sender_private_key);
                type = 'BNB';
            }
            else if(type == 'artw'){
                hashObject = await CoinTransfer(reciver_address, get_amount, sender_address, sender_private_key);
                type = 'ARTW';
            }
            if (hashObject) {
                let hash = hashObject.transactionHash;
                await blockchainServices.addTransaction(user_id, wallet_id, sender_address, reciver_address, hash, get_amount, type);
                req.flash('success_msg', 'Your transaction is proposed and waiting for confirmation.');
                res.redirect('/Transaction-history');
            }
            else {
                req.flash('err_msg', 'Something went wrong.');
                res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type.toLowerCase());
            }
        }
        else {
            req.flash('err_msg', 'Your OTP is incorrect.');
            res.redirect('/verify_2fa')
        }
    }
    else {
        req.flash('err_msg', 'Something went wrong.');
        res.redirect('/Send-artw?walletid=' + wallet_id + '&type=' + type.toLowerCase());
    }
}

const add2Transaction = async (req, res) => {
    let sender_address = req.body.sender_address;
    let reciver_address = req.body.reciver_address;
    let hash = req.body.hash;
    let get_amount = req.body.amount;
    let type = req.body.type;
    let user = await userServices.checkUser(req.body.email);
    let user_id = user._id;
    let loginwallet = await blockchainServices.importWalletFindId(user_id);
    if (loginwallet) {
        // let wallet_details = await blockchainServices.userWalletFindId(loginwallet.wallet_id);
        // if (wallet_details) {
            await blockchainServices.addTransaction(user_id, loginwallet.wallet_id, sender_address, reciver_address, hash, get_amount, type);
            let wallet = {success:1,msg:"Transaction Saved."};
            let wallet_details= JSON.stringify(wallet);
            res.send(wallet_details); 
        // }
    }
}

const do2Transaction = async (req, res) => {
    let user = await userServices.checkUser(req.body.email);
    let user_id = user._id;
    let loginwallet = await blockchainServices.importWalletFindId(user_id);
    let wallet_id = loginwallet.wallet_id;
    let type = req.body.type;
    let sender_address = req.body.sender_address;
    let get_amount = req.body.get_amount;
    let reciver_address = req.body.reciver_address;
    let sender_private_key = req.body.sender_private_key;
    let hashObject = await CoinTransfer(reciver_address, get_amount, sender_address, sender_private_key);    
    if (hashObject) {
        let hash = hashObject.transactionHash;
        await blockchainServices.addTransaction(user_id, wallet_id, sender_address, reciver_address, hash, get_amount, type);
        let wallet = {success:1,msg:"Transaction Saved.",hash:hash};
        let wallet_details= JSON.stringify(wallet);
        res.send(wallet_details); 
    }
    else {
        let wallet = {success:0,msg:"Transaction Failed."};
        let wallet_details= JSON.stringify(wallet);
        res.send(wallet_details); 
    }
}

module.exports = {
    createWallet,
    verifyWallet,
    submitWallet,
    sendCoin,
    verify2fa,
    send2fa,
    add2Transaction,
    do2Transaction
};