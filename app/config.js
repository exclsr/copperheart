//----------------------------------------------------
// config.js
//
var port = process.env.PORT || 3000;

var stripeApiTest = process.env.STRIPE_API_TEST || 'missing api key';
var stripeApiLive = process.env.STRIPE_API_LIVE || 'missing api key';

// TODO: These keys are used on the client side, so we're
// going to want to use a templating engine like jade sooner
// rather than later.
// var stripePublicTest = process.env.STRIPE_PUBLIC_TEST || 'missing public key';
// var stripePublicLive = process.env.STRIPE_PUBLIC_LIVE || 'missing public key';

var sessionSecret = process.env.SESSION_SECRET || "(express session secret)";

var smtpUsername = process.env.AMAZON_SMTP_USER || "(amazon smtp user)";
var smtpPassword = process.env.AMAZON_SMTP_PASS || "(amazon smtp password)";

// Use an overrides file so we can have something
// for local testing that is otherwise ignored
// in our repo.
var overrides;
try {
	overrides = require('./configOverrides.js');
}
catch (err) { 
	// Don't worry about it.
	// Set overrides to 'false' to allow to use
	// the || operator in the exports, below.
	overrides = false; 
}

exports.port = function() {
	return overrides.port || port;
};

exports.stripeApiTest = function() {
	return overrides.stripeApiTest || stripeApiTest;
};

exports.stripeApiLive = function() {
	return overrides.stripeApiLive || stripeApiLive;
};

exports.sessionSecret = function() {
	return overrides.sessionSecret || sessionSecret;
};

exports.smtpUsername = function() {
	return overrides.smtpUsername || smtpUsername;
};

exports.smtpPassword = function() {
	return overrides.smtpPassword || smtpPassword;
};