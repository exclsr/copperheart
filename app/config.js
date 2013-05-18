//----------------------------------------------------
// config.js
//
var isProduction = (process.env.NODE_ENV === "production");

var adminEmailAddresses = process.env.ADMIN_EMAIL_ADDRESSES.split(",") || [];
var memberEmailAddresses = process.env.MEMBER_EMAIL_ADDRESSES.split(",") || [];
var entranceUsernames = process.env.ENTRANCE_USERNAMES.split(",") || [];

var port = process.env.PORT || 3000;

var database = {
	useAuthentication: process.env.DB_USE_AUTH || false,
	username: process.env.DB_USERNAME || "",
	password: process.env.DB_PASSWORD || "",
	host: process.env.DB_HOST || "http://localhost",
	port: process.env.DB_PORT || 5984,
	name: process.env.DB_NAME || "sandbox",
	secureHost: process.env.DB_SECURE_HOST || "http://localhost",
	securePort: process.env.DB_SECURE_PORT || 5984
};

var stripeApiTest  = process.env.STRIPE_API_TEST || 'missing stripe api key';
var stripeApiLive  = process.env.STRIPE_API_LIVE || 'missing stripe api key';
var stripeConnectClientId = process.env.STRIPE_CONNECT_CLIENT_ID || 'missing stripe connect client id';

// If multiple developers are working with the same
// Stripe account, there can be data conflicts during test.
// Set this to be a unique value for you, like 
// your GitHub name, and relax.
var stripeTestClientId = undefined;

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

// TODO: There is probably a way to make this cool, so
// that the code below doesn't have to be copied and
// added to every time a new field is added -- or we
// can at least make it a lot smaller. Maybe putting
// everything in one config object (json) that is exported
// is the way to start ...
exports.isProduction = function() {
	return overrides.isProduction || isProduction;
};

exports.adminEmailAddresses = function() {
	return overrides.adminEmailAddresses || adminEmailAddresses;
};

exports.memberEmailAddresses = function() {
	return overrides.memberEmailAddresses || memberEmailAddresses;
};

exports.entranceUsernames = function() {
	return overrides.entranceUsernames || entranceUsernames;
};

exports.database = function() {
	return overrides.database || database;
};

exports.port = function() {
	return overrides.port || port;
};

exports.stripeApiTest = function() {
	return overrides.stripeApiTest || stripeApiTest;
};

exports.stripeApiLive = function() {
	return overrides.stripeApiLive || stripeApiLive;
};

exports.stripeConnectClientId = function() {
	return overrides.stripeConnectClientId || stripeConnectClientId;
};

exports.stripeTestClientId = function() {
	return overrides.stripeTestClientId || stripeTestClientId;
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