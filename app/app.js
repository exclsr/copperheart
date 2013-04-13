
/**
 * Module dependencies.
 */

var express = require('express')
	, routes  = require('./routes')
	, user    = require('./routes/user')
	, http    = require('http')
	, path    = require('path')
	, config  = require('./config.js')
	, auth    = require('./lib/auth.js')
	, db      = require('./lib/database.js').db;

var apiKey = config.stripeApiTest(); 
var stripe = require('stripe')(apiKey);

var app = express();

app.configure(function(){
	app.set('port', config.port());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(auth.firstRun); // TODO: Auth ...
	// Required for auth:
	// TODO: Consolidate these things somewhere appropriate.
	app.use(express.cookieParser());
	app.use(express.session({ secret: config.sessionSecret() }));
	app.use(auth.initialize());
	app.use(auth.session());
	// end-required for auth.
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

//----------------------------------------------------------------
// Data: Authentication
//----------------------------------------------------------------
var loginFailureUrl = '/';

// GET /auth/google
//   Use auth.authenticate() as route middleware to authenticate the
//   request. The first step in Google authentication will involve redirecting
//   the user to google.com. After authenticating, Google will redirect the
//   user back to this application at /auth/google/return
app.get('/auth/google', 
	auth.authenticate('google', { failureRedirect: loginFailureUrl }),
		function (req, res) {
			// This response doesn't matter, because we get redirected
			// to /auth/google/return anyway.
			res.send(':-)');
		}
);

// GET /auth/google/return
app.get(auth.googleReturnUrl, auth.authMiddleware);

// Logout ...
app.get('/auth/logout', function (req, res){
	req.logout();
	res.redirect('/');
});

// Simple route middleware to ensure client is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the client will be given a 401.
var ensureAuthenticated = function(req, res, next) {
	if (req.isAuthenticated()) { 
		return next(); 
	}

	res.header("WWW-Authenticate", "Google OpenID")
	res.send(401,
		"To get a more desirable response," +
		" please first authenticate with the server," +
		" and try again.");
};

app.get('/whoami', function (req, res) {
	if (req.user) {
		var patron = req.user;
		res.send(patron.id);
	}
	else {
		res.send("anonymous");
	}
});

app.get('/things/:username/', function (req, res) {

	var success = function (things) {
		res.send(things);
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	db.things.get(req.params.username, success, failure);
});

app.get('/contributions/:toUsername', function (req, res) {
	if (!req.user) {
		// 'Anonymous' doesn't have any contributions.
		res.send([]);
		return;
	}
	//
	// At this point, it's implied that we're logged in,
	// and we're looking for the contributions from
	// the logged-in patron to the person associated 
	// with specified username.
	//
	var patron = req.user;

	var success = function (rawContribution) {
		// TODO: Probably want to modify our data
		// layer so we don't have to do this all 
		// the time.
		var things = rawContribution[0].things;
		res.send(things);
	}

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	var gotProject = function (project) {
		db.contributions.get(patron.id, project.id, success, failure);
	};

	db.patrons.getByUsername(req.params.toUsername, gotProject, failure);
});


app.get('/patron', ensureAuthenticated, function (req, res) {
	// TODO: Maybe not do 'ensureAuthenticated' here, and instead
	// send back something empty if we're not logged in, and have 
	// the client deal with that scenario.

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	var gotPatron = function (patronData) {
		var patron = {};
		patron.email = patronData.email;
		patron.username = patronData.username;
		patron.things = patronData.things;
		patron.name = patronData.name;
		patron.present = patronData.present;

		res.send(patron);
	};

	db.patrons.get(req.user.email, gotPatron, failure);
});

app.put('/patron/things', ensureAuthenticated, function (req, res) {
	var patron = req.user;
	var things = req.body;

	var success = function (things) {
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	// TODO: Do we have to do anything with 'things' to be 
	// on the safe side?
	db.things.save(patron.username, things, success, failure);
	res.send(things);
});

app.put('/patron/who', ensureAuthenticated, function (req, res) {
	var patron = req.user;
	var who = req.body;

	var success = function (things) {
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	patron.name = who.name;
	patron.present = who.present;
	db.patrons.save(patron, success, failure);
});


// Some day we'll use jade for basic templating. 
// For now, AngularJS in /public. 
// 
// app.get('/', routes.index);
// app.get('/users', user.list);

// TODO: Figure out a way to share this price code
// on both the client and the server (if practical).
var priceNow = function(things) {
	var totalPrice = 0;

	things.forEach(function (thing) {
		if (thing.canHaz && !thing.recurring) {
			totalPrice += thing.price;
		}
	});

	return totalPrice.toFixed(2);
};

// TODO: Figure out a way to share this price code
// on both the client and the server (if practical).
var perMonthMultiplier = function (frequency) {
	switch (frequency) {
		case 'day': 
			return 365.0 / 12.0;

		case 'week': 
			// There are 4 and 1/3 weeks 
			// each month, on average.
			return 52.0 / 12.0;

		case 'month':
		default:
			return 1.0;
	}
};

// TODO: Figure out a way to share this price code
// on both the client and the server (if practical).
var pricePerMonth = function(things) {
	var pricePerMonth = 0;

	things.forEach(function (thing) {
		var itemPrice = 0;

		if (thing.canHaz && thing.recurring) {
			itemPrice = thing.price * perMonthMultiplier(thing.frequency);
			pricePerMonth += itemPrice;
		}
	});

	return pricePerMonth.toFixed(2);
};


var getStripePlanId = function (patronId) {
	return patronId + '-contribution';
}

var getStripePlanRequest = function (patronId, things) {
	// This is one person's monthly contribution into to the pool.
	//
	// TODO: This is an important point if we ever want
	// to have more than one person receiving money.
	//
	// Will need to update the things array to include 
	// all other payments -- right now we're just working 
	// with the active session. This will have to be taken 
	// care of when there is more than one person receiving.

	var planId = getStripePlanId(patronId);
	var planName = patronId + ' contribution';

	var price = pricePerMonth(things);
	var pricePerMonthInCents = price * 100;

	var planRequest = {
		id: planId, 
		amount: pricePerMonthInCents,
		currency: 'usd',
		interval: 'month',
		interval_count: 1,
		name: planName,
		trial_period_days: 2 
		// TODO: calculate the trial period based on what day they want to pay.
		// maybe. need to figure out how plans are first charged. a better way
		// might be to just add things to a commit pool and take them out at
		// a scheduled time (as per client's config).
	};

	return planRequest;
};


app.put('/commit/:toUsername/', ensureAuthenticated, function (req, res) {

	var patronId = req.body.patronId;
	var stripeToken = req.body.stripeToken;
	var things = req.body.things;

	var patron = req.user;
	var serverSidePatronId = patron.id;

	if (patronId !== serverSidePatronId) {
		res.send(412, 
			"The patron name specified in your request does not match" +
			" who the server thinks is logged in." + 
			" Can you help us solve this mystery?");
		return;
	}
	//
	// We are now authenticated, and have a user object.
	//
	var success = function(patronId) {
		if (patronId) {
			console.log(patronId);
		}
		
		res.send("♥");
	}

	var failure = function (err) {
		console.log(err);
		res.send(500);
	};

	var doStripeStuff = function () {
		// 1. See if our patron has a Stripe ID.
		if (patron.stripeId) {
			// If they do, cool. That means they've been here before, 
			// and we need to update their subscription plan in Stripe.

			// Furthermore, Stripe doesn't allow us to edit subscriptions
			// once they've been created. That's fine. Let's delete
			// the active subscription, and create a new one with the
			// details that we want.
			var createPlanAnew = function () {
				var planRequest = getStripePlanRequest(patronId, things);
				stripe.plans.create(planRequest, function (err, planResponse) {
					// TODO: Do anything with the response?
					err ? failure(err) : success(patronId);
				});
			};

			var handleDeleteResponse = function (err, deleteResponse) {
				// Plan was deleted. Create plan anew.
				err ? failure(err) : createPlanAnew();
			};

			var deleteAndCreatePlan = function () {
				var stripePlanId = getStripePlanId(patronId);
				stripe.plans.del(stripePlanId, handleDeleteResponse);
			};

			deleteAndCreatePlan();
		}
		else {
			// If the patron doesn't have a Stripe ID, cool. That 
			// means we need to create a customer for them in Stripe, 
			// create a subscription plan for them, and associate the two.
			var stripeCustomerCreated = function (customerResponse) {
				patron.stripeId = customerResponse.id;
				// TODO: What if we fail at this point? That's not cool,
				// because then we have some stuff on the Stripe servers
				// that isn't referenced on ours. That would be bad.
				//
				// Possible solution: Run audits every night on the data.
				// Every subscription in our Stripe database has a customer id
				// associated with it, and so that customer id should be
				// found in our data.
				db.patrons.save(patron, success, failure);
			};

			var stripePlanCreated = function (planResponse) {
				// After creating the Stripe plan, 
				// make a Stripe customer to associate with the plan.
				var customerRequest = {
					card: stripeToken,
					description: patronId, 
					plan: planResponse.id
				};

				console.log("Creating customer ...");
				// TODO: If we get a failure at this point, we have a data
				// integrity issue, because it is likely a customer already exists.
				stripe.customers.create(customerRequest, function (err, customerResponse) {
					err ? failure(err) : stripeCustomerCreated(customerResponse);
				});
			};

			// It's more convenient to create a subscription plan,
			// before creating a customer, so we can create a customer
			// and associate them with a plan in one step.
			var createPlanAndCustomer = function () {
				var planRequest = getStripePlanRequest(patronId, things);
				console.log("Creating plan ...");
				// TODO: If we get a failure at this point, we have a data
				// integrity issue, because it is likely a plan already exists.
				stripe.plans.create(planRequest, function (err, planResponse) {
					err ? failure(err) : stripePlanCreated(planResponse);
				});
			};
			
			createPlanAndCustomer();
		};
	}

	
	db.patrons.getByUsername(req.params.toUsername, 
		function (project) {
			// Save the contributions to our database, first.
			var contribution = {};
			contribution.backerId = patronId;
			contribution.projectId = project.id;
			contribution.things = things;

			db.contributions.save(contribution, doStripeStuff, failure);
		},
		failure);

	return;

	// TODO: MVP: Get things from our database, so that
	// we use the prices in there and not the ones
	// given to us by the client.

	var oneTimeCharge = priceNow(things);
	var oneTimeChargeInCents = oneTimeCharge * 100;

	// TODO: MVP: Put email (or id) of backer in the description, below
	var chargeRequest = {
		amount: oneTimeChargeInCents,
		currency: 'usd',
		card: stripeToken,
		description: 'among the first tests'
	};

	stripe.charges.create(chargeRequest, function(err, chargeResponse) {
		if (err) {
			// TODO: Obviously ...
			console.log(err);
			res.send(500);
		}
		else {
			// Success! 
			console.log(chargeResponse);
			res.send("Ok");
		}
	});

});

http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});
