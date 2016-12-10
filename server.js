var express = require('express');
var app = require('express')();
//Load the request module
var request = require('request');
var http = require('http').Server(app);


var io = require('socket.io')(http);
var databaseName = 'chargeandmove';
var MongoClient = require('mongodb').MongoClient,
    Server = require('mongodb').Server,
    ReplSetServers = require('mongodb').ReplSetServers,
    ObjectID = require('mongodb').ObjectID,
    Binary = require('mongodb').Binary,
    GridStore = require('mongodb').GridStore,
    Grid = require('mongodb').Grid,
    Code = require('mongodb').Code;

// default to a 'localhost' configuration:
var connection_string = '127.0.0.1:27017/moveandcharge';
// if OPENSHIFT env variables are present, use the available connection info:
if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
  connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
  process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
  process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
  process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
  process.env.OPENSHIFT_APP_NAME;
}

var mongojs = require('mongojs');
var db = mongojs(connection_string, ['books']);
var books = db.collection('books');
console.log(db);
// similar syntax as the Mongo command-line interface
// log each of the first ten docs in the collection
db.books.find({}).limit(10).forEach(function(err, doc) {
  if (err) throw err;
  if (doc) { console.dir(doc); }
});

var webpush = require('web-push');
var gcmApiKey = 'AAAArCJxczc:APA91bFXVrYh65BH2FQwFkoFiSosADf4jXMQHxXUkKC_4NL25TfGAVxqm06xvGg01L7oqSaBhyV4jAvx8vEtyoCy8hMz75XSYBMzSWn_XDYE8Wkni32Hk_mnUt6fAT8L_Ssl4-z64HFdKGRz4VI_9lsIAgf2NLl5fg';//from firebase
var notification_collection = 'notification_collection', vapidKeyCollection = 'vapidKeyCollection';
var emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
// if(process.env.OPENSHIFT_NODEJS_PORT) {
//  mongoURL = mongoURLcloud;
//  console.log("Using mongo cloud url %s",mongoURL);
// }
// else{
//  mongoURL = mongoURLlocal;
//  console.log("Using mongo local url %s",mongoURL);
// }


app.use(express.static('public'));
var ipaddress = process.env.OPENSHIFT_NODEJS_IP;
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
 if (typeof ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            ipaddress = "127.0.0.1";
};

http.listen(port,ipaddress, function () {
     console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), ipaddress, port);
});


// push notification code : 

function getVapidKeys() {
	var vapidKeyDb = db.collection(vapidKeyCollection);
	currentSensorDb.find({}).toArray(function (err, allMsg) {
				webpush.setGCMAPIKey(gcmApiKey);
                if(allMsg.length==0) {
                    var tempDateTime = new Date();
					var vapidKeysGenerated = webpush.generateVAPIDKeys();
                    db.collection(vapidKeyCollection).insertOne({
                        "publicKey":vapidKeysGenerated.publicKey,
                        "privateKey": vapidKeysGenerated.privateKey,
                        "addedOn": tempDateTime
                    }, function(error, result) {
                        if(error) {
                            console.log('Error while adding vapidKeysGenerated to table.');
                        }
                        else {
                            console.log('vapidKeysGenerated added successfully, public %s and private: %s',vapidKeysGenerated.publicKey, vapidKeysGenerated.privateKey);
                          	
                          	webpush.setVapidDetails(
							  'mailto:bankarharshad91@gmail.com',
							  vapidKeysGenerated.publicKey,
							  vapidKeysGenerated.privateKey
							);
                        }
                    });

                }
                else{
                    console.log('vapidKeysGenerated already present. %s', JSON.stringify(allMsg));
                    console.log('Found VAPID keys already');
					webpush.setVapidDetails(
					  'mailto:bankarharshad91@gmail.com',
					  allMsg[0].publicKey,
					  allMsg[0].privateKey
					);
                }
            });
}

//configure notification plugin
getVapidKeys();

app.post('/notifyapi/addNotificationSubscription', function (req, res) {
    var buffer = [];
    req.on('data', function (chunk) {
        buffer.push(chunk);
    });

    var trueResponse =  { statusCode: 200,
        headers: {
            'content-type': 'application/json'
        },
        body: {
            status: 'OK'
        }
    }

    var falseResponse =  { statusCode: 400,
        headers: {
            'content-type': 'application/json'
        },
        body: {
            status: 'NO'
        }
    }
    req.on('end', function () {
        var payload = {};
        try {
            payload = JSON.parse(Buffer.concat(buffer).toString());
        } catch (e) {}

        if(payload.endpoint !== '' && payload.userEmail !== '' && emailRegex.test(payload.userEmail)) {

            var notificationDb = db.collection(notification_collection);
         
            var tempDateTime = new Date();
			payload.addedOn = tempDateTime;
			console.log('Saving pushnotification data: %s',JSON.stringify(payload));
            db.collection(sensor_collection).insertOne(payload, function(error, result) {
                if(error) {
                    console.log('Error while adding notification data for user %s',payload.userEmail);
                    res.writeHead(falseResponse.statusCode, falseResponse.headers);
                    res.end(JSON.stringify({status:"Error in mongo DB"}));
                }
                else {
                    console.log('Notification data added successfully for user %s on %s',payload.userEmail, tempDateTime);
                    res.writeHead(trueResponse.statusCode, trueResponse.headers);
                    res.end(JSON.stringify(trueResponse.body));
                }
            });       
        }
        else {
            res.writeHead(falseResponse.statusCode, falseResponse.headers);
            res.end(JSON.stringify({status:"Invalid Request"}));
        }
    })
});

app.post('/notifyapi/sendNotificationSubscription', function (req, res) {
    var buffer = [];
    req.on('data', function (chunk) {
        buffer.push(chunk);
    });

    var trueResponse =  { statusCode: 200,
        headers: {
            'content-type': 'application/json'
        },
        body: {
            status: 'OK'
        }
    }

    var falseResponse =  { statusCode: 400,
        headers: {
            'content-type': 'application/json'
        },
        body: {
            status: 'NO'
        }
    }
    req.on('end', function () {
        var payload = {};
        try {
            payload = JSON.parse(Buffer.concat(buffer).toString());
        } catch (e) {}

        if(payload.userEmail !== '' && emailRegex.test(payload.userEmail)) {

            var notificationDb = db.collection(notification_collection);
            notificationDb.find({ "userEmail": payload.userEmail }).toArray(function (err, allMsg) {

                if(allMsg.length==0) {
                    console.log('No notification data present for user: ',payload.userEmail);
                    res.writeHead(falseResponse.statusCode, falseResponse.headers);
                    res.end(JSON.stringify({status:"No notification data present for user"}));
                }
                else{
                	for(var i=0;i<allMsg.length;i++) {
                		var tempNotficationData = allMsg[i];

                		console.log('Sending push notification to user %s', JSON.stringify(tempNotficationData));
						var pushSubscription = {
						  endpoint: tempNotficationData.endpoint,
						  keys: {
						    auth: tempNotficationData.keys.auth,
						    p256dh: tempNotficationData.keys.p256dh
						  }
						};

						webpush.sendNotification(pushSubscription, payload.notificationText);
						console.log('Sent notification to user: %s', payload.userEmail);

						if(i == allMsg.length) {
                            console.log('Sent notification to all user devices');
                            res.writeHead(trueResponse.statusCode, trueResponse.headers);
                            res.end(JSON.stringify(trueResponse.body));
                        }
                	}
                    
                }
            });       
        }
        else {
            res.writeHead(falseResponse.statusCode, falseResponse.headers);
            res.end(JSON.stringify({status:"Invalid Request"}));
        }
    })
});
