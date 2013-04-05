
/**
 * Module dependencies.
 */

var express = require('express')
	, routes = require('./routes')
	, user = require('./routes/user')
	, http = require('http')
	, path = require('path')
	, config = require('./config.js');

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
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

app.get('/things/phil/', function (req, res) {
	var things = [
			{
				id: "wine",
				name: "wine",
				unit: 'glass',
				price: 5,
				frequency: 'month'
			},
			{
				id: "internet",
				name: "Internet",
				unit: 'day',
				price: 2,
				frequency: 'month'
			},
			{
				id: "groceries",
				name: "groceries",
				unit: 'day',
				price: 10,
				frequency: 'month'
			},
			{
				id: "rent",
				name: "rent",
				unit: 'day',
				price: 30,
				frequency: 'month'
			},
		];

		res.send(things);
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
		if (thing.canHaz) {
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

	return pricePerMonth;
};


var createSubscriptionPlan = function (things, success, failure) {
	// This is one person's monthly contribution into to
	// the pool ....
	// TODO: This is an important point. Will need to 
	// refactor a bit of code to make this happen.

	// TODO: Give each plan a a unique name
	var planId = 'anon-contribution';
	var planName = 'anon contribution';

	var planRequest = {
		id: planId, 
		amount: 0,
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


	var updatePlan = function (success, failure) {
			// Delete the existing plan and create a new one with the same name.
			stripe.plans.del(planId, function (err, deleteResponse) {
				if (err) {
					failure(err);
				}
				else {
					// Plan was deleted. Create plan anew.
					stripe.plans.create(planRequest, function (err, planResponse) {
						if (err) {
							failure(err);
						}
						else {
							success(planResponse);
						}
					});
				}
			});
	};

	stripe.plans.create(planRequest, function (err, planResponse) {
		if (err) {
			if (err.name === 'invalid_request_error') {
				// Probably already have a subscription.
				// TODO: MVP: Confirm this before updating the plan.
				updatePlan(success, failure);
			}
			else {
				failure(err);
			}
		}
		else {
			success(planResponse);
		}
	});

};

var createCustomer = function (stripeToken, planId, success, failure) {

	// TODO: Before we go much farther with this, we need to start
	// talking about the notion of people logging in on the site, and
	// looking up customer objects from the email address on our side 
	// (and then looking up customers via stripe IDs).
	var customerRequest = {
		card: stripeToken,
		description: 'anon customer', // TODO: ...
		plan: planId
	};

	stripe.customers.create(customerRequest, function (err, customerResponse) {
		if (err) {
			failure(err);
		}
		else {
			success(customerResponse);
		}
	});
};

app.put('/cc/charge/', function (req, res) {

	var stripeToken = req.body.stripeToken;
	var things = req.body.things;

	var customerCreated = function (customer) {

		console.log(customer);
		res.send("Ok!");
	};

	var failure = function (err) {
		console.log(err);
		res.send(500);
	};

	var success = function(planResponse) {
		console.log(planResponse);

		createCustomer(stripeToken, planResponse.id, customerCreated, failure);
	};


	createSubscriptionPlan(things, success, failure);
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
