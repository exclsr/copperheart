//----------------------------------------------------
// auth.js
//
// The thing that knows about authentication.
//
var passport = require('passport')
  , GoogleStrategy = require('passport-google').Strategy;

var db = undefined;
var allowedUsers = []; // TODO: Get from db

var googleReturnUrl = '/auth/google/return';
var serverPort = 3000; // TODO: Figure out this dependency

var domain = 'whatever';
var hostUrl = function() {
	if (domain === 'localhost') {
		return 'http://' + domain + ':' + serverPort;
	}
	else {
		// TODO: Assumes we're working on port 80. Fix.
		return 'http://' + domain;
	}
};

var initPassport = function() {
	// Use the GoogleStrategy within Passport.
	//   Strategies in passport require a `validate` function, which accept
	//   credentials (in this case, an OpenID identifier and profile), and invoke a
	//   callback with a user object.
	passport.use(new GoogleStrategy({
		returnURL: hostUrl() + googleReturnUrl,
		realm: hostUrl() + '/'
	},
	function (identifier, profile, done) {
	    // asynchronous verification, for effect...
	    process.nextTick(function () {

	      // To keep the example simple, the user's Google profile is returned to
	      // represent the logged-in user.  In a typical application, you would want
	      // to associate the Google account with a user record in your database,
	      // and return that user instead.
	      profile.identifier = identifier;
	      return done(null, profile);
	  });
	}
	));
};

// middleware that does a few things the first
// time it is called. we have this so that we
// can initialize passportjs with our domain name.
var isFirstRun = true;
var firstRun = function(req, res, next) {
	if (isFirstRun) {
		domain = req.host;
		initPassport();
		isFirstRun = false;
	}
	return next();
};

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  
passport.serializeUser(function (user, callback) {
	// Input: 'user' is what we get from Google when using OpenID.
	// Output: we call 'callback(error, userData)' to tell passport we're done.
	var userEmail = user.emails[0].value;

	var defaultNewUser = {
		id: userEmail,
		email: userEmail,
		username: userEmail,
		backers: {},
		backing: {} // TODO: Defaults like this should be in the data layer.
	};

	// TODO: What, exactly, do we want to serialize into passport?
	// We probably only need the username, possibly the email address,
	// and possibly the id.
	db.patrons.get(userEmail, 
		function (data) {
			// database returned from patrons.get
			if (!data || data === "" || data.length === 0) {
				// The patron was not found in our database. 
				// That is fine, but let's save the profile.
				data = defaultNewUser;
				db.patrons.save(defaultNewUser, 
					function () {
						// New user saved.
						callback(null, data);
					},
					function (error) {
						// Failed to save user.
						callback(null, data);
					});
			}
			else {
				callback(null, data);
			}
		},
		function (error) {
			// database query patrons.get failed.
			callback(null, defaultNewUser);
	});
});

passport.deserializeUser(function (user, callback) {
	// Input: 'user' is what we saved in the serializeUser step.
	// Output: we 'callback(error, userObject)' to tell passport we're done.
	if (user.refreshFromDatabase) {
		db.patrons.get(user.id, 
			function (dbUser) {
				callback(null, dbUser);
			},
			function (error) {
				callback(null, user);
			}
		);
	}
	else {
		callback(null, user);
	}
}); 


var authenticate = function(req, success, failure) {

	return passport.authenticate('google', 
		function (err, user, info) {

			if (err) { 
				failure(err);
			}
			else if (!user) { 
				failure("Invalid login data");
			}
			else {
				// TODO: MVP: Make this cool ...
				// var primaryEmail = user.emails[0].value;
				// if (allowedUsers.indexOf(primaryEmail) >= 0) {
					// req.login is added by the passport.initialize() middleware
					// to manage login state. We need to call it directly, as we're
					// overriding the default passport behavior.
					req.login(user, function(err) {
						if (err) { 
							failure(err);
						}
						success();
					});
				//}
				// else {
				// 	failure("Unknown email address");
				// }
			}
		}
	);
};

// Authentication. This defines what we send
// back to clients that want to authenticate
// with the system.
var authMiddleware = function(req, res, next) {

	var success = function() {
		req.isAuthenticated = true;
		next();
	};

	var failure = function(error) {
		console.log(error);
		// TODO: What is failure, anyway?
		req.isAuthenticated = false;
		next();
	};

	// The auth library provides middleware that
	// calls 'success' or 'failure' in the appropriate
	// login situation.
	var middleware = authenticate(req, success, failure);
	middleware(req, res, next);
};

exports.firstRun = firstRun;
exports.authMiddleware = authMiddleware;
exports.googleReturnUrl = googleReturnUrl;

exports.initialize = function(database) {
	db = database;
	return passport.initialize();
};
exports.session = function() {
	return passport.session();
};

exports.authenticate = authenticate;