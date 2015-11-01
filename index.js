var config = {
  checkInterval: (1/60) // Interval to ping Instagram for usernames, in  minutes
}

var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var db = require('mongoskin').db(process.env.DATABASE_URL);
var nodemailer = require('nodemailer');
var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// for parsing POST requests
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

console.log("Database URL is " + process.env.DATABASE_URL);

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_ADR,
        pass: process.env.NODEMAILER_PWD
    }
});

app.get('/', function (req, res, next) {
  // If this is a user query, check for user
  if (req.query.username) {
    checkForUsername(req.query.username, function(exists) {
      res.render('pages/response', {
        exists: exists,
        username: req.query.username
      });
    });
  // or just load the home page
  } else {
    res.render('pages/index');
  }
});

// Handles email submissions
app.post('/email', function(req, res, next) {
  // Add email to database
  db.collection('users').insertOne( {
    username: req.body.username,
    email: req.body.email
  } );
  res.render('pages/thanks', {
    username: req.body.username
  });
});

// Check Instagram to see if user exists
function checkForUsername(username, cb) {
  var url = "https://www.instagram.com/" + username;
  var exists = false;
  request(url, function(err, res, body) {
    if (res.statusCode === 200) {
      // If the unsername is taken, update message and ask for user's email
      exists = true;
    }
    cb(exists);
  });
}

// Checks database
function checkDatabase() {
  db.collection('users').find().toArray(function(err, result) {
    if (err) {
      throw err;
    }
    var current;
    for (var i = 0; i < result.length; i++) {
      current = result[i];
      checkForUsername(current.username, function(exists) {
        if(!exists) {
          // Notify the user via his email
          transporter.sendMail({
              from: 'willthefirst@gmail.com',
              to: current.email,
              subject: '@' + current.username + ' is now available!',
              text: '@' + current.username + ' is now available! Claim it with in the app: https://itunes.apple.com/app/instagram/id389801252?pt=428156&ct=igweb.unifiedHome.badge&mt=8'
          }, function(err, info) {
            if (err) {
              console.log(err);
              throw err;
            }
          });
          // Remove this user from the DB
          db.collection('users').remove( { username : current.username } )
        } else {
          // User still unavailable;
        }
      })
    }
  });
}

// Check stuff every 60 minutes
var checkStuff = setInterval(function(str1, str2) {
  checkDatabase();
  console.log('Database checked.');
}, (config.checkInterval * 60 * 1000) );

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
