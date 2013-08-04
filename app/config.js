//----------------------------------------------------
// config.js
//
var isProduction = (process.env.NODE_ENV === "production");

var parseList = function (envVar) {
	if (envVar) {
		return envVar.split(",");
	}
	else {
		return [];
	}
};

var adminEmailAddresses = parseList(process.env.ADMIN_EMAIL_ADDRESSES);
var memberEmailAddresses = parseList(process.env.MEMBER_EMAIL_ADDRESSES);
var entranceUsernames = parseList(process.env.ENTRANCE_USERNAMES);

var port = process.env.PORT || 3000;

var analytics = {
	domain: process.env.ANALYTICS_DOMAIN,
	id: process.env.ANALYTICS_ID
};

var database = {
	username: process.env.DB_USERNAME || "",
	password: process.env.DB_PASSWORD || "",
	host: process.env.DB_HOST || "localhost",
	port: process.env.DB_PORT || 5984,
	useHttps: process.env.DB_USE_HTTPS || false,
	name: process.env.DB_NAME || "sandbox"
};

// can be passed directly into connect-redis
var redis = {
	host: process.env.REDIS_HOST || "localhost",
	port: process.env.REDIS_PORT,
	pass: process.env.REDIS_PASSWORD
};

var stripePublicTest = process.env.STRIPE_PUBLIC_TEST || 'missing stripe public key';
var stripePublicLive = process.env.STRIPE_PUBLIC_LIVE || 'missing stripe public key';
var stripeApiTest  = process.env.STRIPE_API_TEST || 'missing stripe api key';
var stripeApiLive  = process.env.STRIPE_API_LIVE || 'missing stripe api key';
var stripeConnectClientId = process.env.STRIPE_CONNECT_CLIENT_ID || 'missing stripe connect client id';

// If multiple developers are working with the same
// Stripe account, there can be data conflicts during test.
// Set this to be a unique value for you, like 
// your GitHub name, and relax.
var stripeTestClientId = undefined;

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

exports.analytics = function() {
	return overrides.analytics || analytics;
};

exports.database = function() {
	return overrides.database || database;
};

exports.redis = function() {
	return overrides.redis || redis;
}

exports.port = function() {
	return overrides.port || port;
};

exports.stripePublicTest = function() {
	return overrides.stripePublicTest || stripePublicTest;
};

exports.stripePublicLive = function() {
	return overrides.stripePublicLive || stripePublicLive;
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