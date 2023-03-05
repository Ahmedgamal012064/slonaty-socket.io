const express = require('express');
const functions = require('./functions');
const database = require('./database');
var path = require('path');
const cors = require('cors');
require('dotenv').config();
const { instrument } = require("@socket.io/admin-ui");

const app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(cors());


const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    pingInterval: 25000,
    pingTimeout: 20000,
    maxPayload: 1e6,
    cors: {
        origin: "*",
    }
});
instrument(io, {
    auth: false,
    mode: "development",
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server is running');
});

app.get('/', (req, res) => {
    res.send('Hello world');
});

let selectlive = functions.query_mysql({
    sql: 'SELECT current_counter FROM branches WHERE id = ?',
    timeout: 5000, // 40s
    values: [1]
});
selectlive.then((data) => {
    console.log("selectlive DATA IS : " + data[0].current_counter);
});


/*########################### Start user Socket.io ################################*/
io.on('connection', (socket) => {
    try {
        console.log('connection id :' + socket.id); //default socket room
        /**************************************************************************
        /****************************[Make New Order]*****************************/
        try {
            socket.on('makeorder', (body) => {
                var check_auth = send_api_request(process.env.Express_APP_URL + "/api/check-user-auth", 'GET', {}, body.api_token);
                var make_order = send_api_request(process.env.Express_APP_URL + "/api/user/make-order", 'POST', body, body.api_token);

                check_auth.then((data) => {
                    if (data.status == true) {
                        make_order.then((data2) => {
                            if (data2.status == true) {
                                io.emit('book_number', { branch_id: data2.branch_id, book_number: data2.book_number });
                                socket.emit('make_order_response', {
                                    status: true,
                                    msg: "order created successfully",
                                    data: {
                                        order_id: data2.order_id,
                                        order_id_encrypt: data2.order_id_encrypt,
                                        book_number: data2.book_number,
                                        branch_id: data2.branch_id,
                                    }
                                });
                                socket.emit('order_casher')
                            } else {
                                socket.emit('make_order_response', { status: false, msg: data2.msg });
                            }
                        });
                    } else {
                        socket.emit('make_order_response', { status: false, msg: "unauthization" });
                    }
                });
            });
        } catch (e) {
            console.log('Error is :' + e.message);
            socket.emit('make_order_response', { status: false, error_res: e.message, success_res: "" });
            Telegram_message_bot(e.message + ' [ in Error Socket make order]');
        }
        /****************************************************************************
        /***********************[casher increase_live_number]***********************/
        socket.on('increase_live_number', (body) => {
            var casher_id = body.casher_id;
            functions.query_mysql({
                sql: 'UPDATE branches SET current_counter = current_counter + 1 WHERE id = ? ',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });
            let selectlive = functions.query_mysql({
                sql: 'SELECT current_counter FROM branches WHERE id = ?',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });
            selectlive.then((data) => {
                io.emit('live_number', { branch_id: body.branch_id, live_number: data[0].current_counter });
                send_fcm_msg('token', 'title', 'body');
            });

        });
        /****************************************************************************
        /*****************[Casher after scan qr-code api  with worker_id]***********/
        socket.on('scan_qr', (body) => {
            $cahsher__id = body.cahsher__id;
            functions.query_mysql({
                sql: 'UPDATE branches SET current_counter = current_counter + 1 WHERE id = ? ',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });
            let selectlive = functions.query_mysql({
                sql: 'SELECT current_counter FROM branches WHERE id = ?',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });
            functions.query_mysql({
                sql: 'UPDATE orders SET worker_id = ? , status = ?  WHERE id = ? ',
                timeout: 5000, // 40s
                values: [body.worker_id, 2, body.order_id]
            });
            selectlive.then((data) => {
                io.emit('live_number', { branch_id: body.branch_id, live_number: data[0].current_counter });
                send_fcm_msg('token', 'title', 'body');
            });
        });
        /****************************************************************************
        /***********[Start Casher press skip order skip offline press next btn]******/
        socket.on('press_skip', (body) => { //in this case card order user has two button scan qr ans skip if want to skip offline press next
            functions.query_mysql({
                sql: 'UPDATE branches SET current_counter = current_counter + 1 WHERE id = ? ',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });
            let selectlive = functions.query_mysql({
                sql: 'SELECT current_counter FROM branches WHERE id = ?',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });
            functions.query_mysql({
                sql: 'UPDATE orders SET status = ? WHERE id = ? ',
                timeout: 5000, // 40s
                values: [0, body.order_id]
            });
            selectlive.then((data) => {
                io.emit('live_number', { branch_id: body.branch_id, live_number: data[0].current_counter });
                send_fcm_msg('token', 'title', 'body');
            });
        });
        /*****************************************************************************
        /******************[Start Casher press increase book number]*****************/
        socket.on('increase_book_number', (body) => {
            functions.query_mysql({
                sql: 'UPDATE branches SET counter_booked = counter_booked + 1 WHERE id = ? ',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });
            let selectlive = functions.query_mysql({
                sql: 'SELECT counter_booked FROM branches WHERE id = ?',
                timeout: 5000, // 40s
                values: [body.branch_id]
            });

            selectlive.then((data) => {
                io.emit('book_number', { branch_id: body.branch_id, book_number: data[0].counter_booked });
            });
        });
        /***************************************************************************/

        socket.on('disconnect', (reason) => {
            console.log('Disconnect reason is :' + reason);
        }); /** disconnect **/
        socket.on("error", (err) => {
            if (err) {
                console.log('Error is :' + err.message);
                Telegram_message_bot(err.message + ' [ in Error Socket]');
                socket.disconnect();
            }
        }); /** Error **/
    } catch (e) {
        Telegram_message_bot(e.message + ' [server.js in Error Socket]');
        socket.disconnect();
    }
});
/*########################### End user Socket.io ################################*/

module.exports = server;


/*
    socket.emit ==> send data to all clients in active tab
    io.emit ==> send data to all clients all in mysocket (use it live number and book to show counter to all users)
    socket.broadcast.emit  => all without this client,

    EX) socket.emit(send_data,value1,value2)  ===> socket.on(send_data,(v1,v2) => {})
    EX) socket.emit(send_data,{value1:value2, ahmed:ahmed})  ===> socket.on(send_data,(data) => { data.ahmed })
*/
/***** TEST FETCH HELPER FUNCTION *******

    let add = functions.query_mysql({
        sql: 'SELECT current_counter from branches WHERE id = ?',
        timeout: 5000, // 40s
        values: [1]
    });
    add.then((data) => { // promise and callback function
        console.log('data :', data); // result
        console.log("END");

    });
    /*****************CHECK USER AUTH

    var data = Check_User_Auth(process.env.Express_APP_URL + "/api/check-user-auth", 'GET', {}, api_token);
    data.then((data) => { // promise and callback function
        console.log('data Check_User_Auth:', data); // result
        console.log("END");

    });

    /******************Encrypt and Decrypt
    var da = encrypt_decrypt_msg('1', 'encrypt');
    da.then((data) => {
        console.log('Data encrypted is Ahmed  : ' + data);
    });
***********************************************************************************************************************************************************************************/