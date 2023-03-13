const mysql = require('mysql2');
const helpers = require('./functions');
require('dotenv').config();


var connection = mysql.createConnection({
    host: '145.14.151.35',
    database: 'u864597826_eljoker',
    user: 'u864597826_eljoker',
    password: 'Eljoker@2203',
    multipleStatements: true
});

connection.connect(async function(error) {
    if (error) {
        // throw error;
        Telegram_message_bot(error + ' [ in Connection database]')
    } else {
        console.log('MySQL Database is connected Successfully');
    }
});

module.exports = connection;