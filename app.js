
/**
	* Node.js Login Boilerplate
	* More Info : https://github.com/braitsch/node-login
	* Copyright (c) 2013-2018 Stephen Braitsch
**/
const fs = require('fs');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var MongoStore = require('connect-mongo')(session);
//var engines = require('consolidate');



var app = express();

// Certificate
const privateKey = fs.readFileSync('/etc/letsencrypt/live/wakeorrip.com/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/wakeorrip.com/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/wakeorrip.com/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

var https = require('https').createServer(credentials, app);

// redirect HTTP server
var http = require('http');
var redirectApp = express();
redirectServer = http.createServer(redirectApp);
redirectApp.use(function requireHTTPS(req, res, next) {
  if (!req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
})

redirectServer.listen(80);


app.locals.pretty = true;
//app.set('port', process.env.PORT || 80);
app.set('port', process.env.PORT || 443);
app.set('views', __dirname + '/app/server/views');
app.set('view engine', 'pug');
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('stylus').middleware({ src: __dirname + '/app/public' }));
app.use(express.static(__dirname + '/app/public'));

// build mongo database connection url //

process.env.DB_HOST = process.env.DB_HOST || 'localhost'
process.env.DB_PORT = process.env.DB_PORT || 27017;
process.env.DB_NAME = process.env.DB_NAME || 'node-login';

console.log(app.get('env'));
if (app.get('env') != 'live'){
	process.env.DB_URL = 'mongodb://'+process.env.DB_HOST+':'+process.env.DB_PORT;
}	else {
// prepend url with authentication credentials //
	process.env.DB_URL = 'mongodb://'+process.env.DB_USER+':'+process.env.DB_PASS+'@'+process.env.DB_HOST+':'+process.env.DB_PORT;
}

console.log(process.env.DB_URL);

app.use(session({
	secret: 'faeb4453e5d14fe6f6d04637f78077c76c73d1b4',
	proxy: true,
	resave: true,
	saveUninitialized: true,
	store: new MongoStore({ url: process.env.DB_URL })
	})
);

var AM = require('./app/server/modules/account-manager');
require('./app/server/routes')(app);

var io = require('socket.io')(https);



https.listen(app.get('port'), function(){
	console.log('Express server listening on port ' + app.get('port'));
});


var awsIot = require('aws-iot-device-sdk');



var device = awsIot.device({
   keyPath: './ESP32V1.private.key',
  certPath: './ESP32V1.cert.pem',
    caPath: './root-CA.crt',
  clientId: 'MyConnect',
   host: 'a1g8gmosrtyej5-ats.iot.us-east-2.amazonaws.com'
});

io.on('connection', function(socket){
  console.log('a user connected');

	socket.on('sendData', function(msg){
		console.log('sendData: ' + msg);
		device.publish('Subscribed', msg);
	});

	socket.on('storeLocation', function(msg){
		console.log('storeLocation: ' + msg);
		AM.storeLocation(msg.name, msg.lat, msg.long, msg.radius , function(e){
			if (e){
				res.status(400).send(e);
			}	else{
				res.status(200).send('ok');
			}
		});
	});

	socket.on('alarmState', function(msg){
		console.log('alarmState: ' + msg);
		AM.alarmState(msg.name, msg.alarmState, function(e){
			if (e){
				res.status(400).send(e);
			}	else{
				res.status(200).send('ok');
			}
		});
	});

	socket.on('sendDistance', function(msg){
		console.log('distanceFromStart: ' + msg);
	});

});

device
  .on('connect', function() {
    console.log('connected to AWS IoT');
    //device.subscribe('ACK');
    //device.publish('Subscribed', "OffLED");
  });

device
  .on('message', function(topic, payload) {
    console.log('message', topic, payload.toString());
  });
