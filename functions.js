const axios = require('axios');
const request = require('request');
require('dotenv').config();
const database = require('./database');
var FCM = require('fcm-node');
var serverKey = require("./eljoker-f0974-firebase-adminsdk-oxm11-4a01ce5cc6.json");
var fcm = new FCM(serverKey);
const crypto = require("crypto");
const algorithm = "aes-256-cbc";
// generate 16 bytes of random data
const initVector = crypto.randomBytes(16);
// secret key generate 32 bytes of random data
const Securitykey = crypto.randomBytes(32)

Telegram_message_bot = async function(error) {
    const url = 'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage?chat_id=' + process.env.TELEGRAM_CHAT_ID + '&text=' + error;
    request(url, { json: true }, (err, res, body) => {
        if (err) { return console.log(err); }
        console.log('success send message telegram');
    });
}

encrypt_decrypt_msg = async function(msg, type) {
    try {
        return new Promise((resolve, reject) => {
            if (type == "encrypt") {
                const cipher = crypto.createCipheriv(algorithm, Securitykey, initVector);
                let encryptedData = cipher.update(msg, "utf-8", "hex");
                encryptedData += cipher.final("hex");
                console.log("Encrypted message: " + encryptedData);
                return resolve(encryptedData);
            } else {
                const decipher = crypto.createDecipheriv(algorithm, Securitykey, initVector);
                let decryptedData = decipher.update(msg, "hex", "utf-8");
                decryptedData += decipher.final("utf8");
                console.log("Decrypted message: " + decryptedData);
                return resolve(decryptedData);
            }
        });
    } catch (error) {
        Telegram_message_bot(error.message + ' [ in Error encrypt_decrypt_msg function]');
    }

}


send_api_request = async function(url, method, body, token) {
    // axios.post(url, body, header)
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    }
    var clientServerOptions = {
        uri: url,
        body: JSON.stringify(body),
        method: method,
        headers: headers
    }

    return new Promise((resolve, reject) => {
        console.log("START");
        request(clientServerOptions, function(error, response) {
            if (error) {
                Telegram_message_bot(error.message + ' [ in Error Check_User_Auth function]');
                console.log(error);
                throw error;
            }
            if (!error && response.statusCode == 200) {
                console.log(JSON.parse(response.body));
                return resolve(JSON.parse(response.body));

            }

        })
    });

    // await axios({
    //         method: method,
    //         url: url,
    //         config,
    //         data: body
    //     })
    //     .then((res) => {
    //         console.log(`statusCode: ${res.status}`);
    //         console.log(res.data);
    //         return res.data;
    //     })
    //     .catch((error) => {
    //         console.error(error);
    //         return { error: error };
    //     });
}


send_fcm_msg = function(token, title, body) {
    fcm.send({ //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        to: token,
        //collapse_key: 'your_collapse_key',

        notification: {
            title: title,
            body: body
        }
    }, function(err, response) {
        if (err) {
            console.log("Something in FCM has gone wrong!");
            response.json({
                "error": err
            })
        } else {
            console.log("Successfully FCM sent with response: ", response);
        }
    });
}

query_mysql = async function(sqlQuery) {
    return new Promise((resolve, reject) => {
        console.log("START");
        if (sqlQuery) {
            database.query(sqlQuery, function(error, result, fields) {
                //console.log('Database Rsult : ' + result);
                if (error) {
                    Telegram_message_bot(error.message + ' [ in Error query_mysql function]');
                    throw error;
                } else {
                    // database.destroy();
                    return resolve(result);
                }
            });
        } else {
            database.end(); // end connection
            // code:  handle the case
        }
    });
}


module.exports = {
    Telegram_message_bot: Telegram_message_bot,
    send_api_request: send_api_request,
    send_fcm_msg: send_fcm_msg,
    query_mysql: query_mysql,
    encrypt_decrypt_msg: encrypt_decrypt_msg,
}