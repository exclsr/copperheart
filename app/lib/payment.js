//----------------------------------------------------
// payment.js
//
// The thing that knows about payments, Stripe.
//
var qs = require('querystring');
var db, apiKey, stripeTestClientId;

var getStripePlanId = function (patronId, memberId) {
	var planId = patronId + '-contribution-to-' + memberId;

	if (stripeTestClientId) {
		planId += '-' + stripeTestClientId;
	}

	return planId;
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
			itemPrice = parseFloat(thing.price) * perMonthMultiplier(thing.frequency);
			pricePerMonth += itemPrice;
		}
	});

	return pricePerMonth.toFixed(2);
};

var getStripePlanRequest = function (patronId, memberId, things, daysUntilFirstPayment) {
	var planId = getStripePlanId(patronId, memberId);
	var planName = patronId + ' contribution to ' + memberId;

	if (stripeTestClientId) {
		planName += ' created by ' + stripeTestClientId;
	}

	var price = pricePerMonth(things);
	var pricePerMonthInCents = price * 100;

	var planRequest = {
		id: planId, 
		amount: pricePerMonthInCents,
		currency: 'usd',
		interval: 'month',
		interval_count: 1,
		name: planName,
		trial_period_days: daysUntilFirstPayment 
	};

	return planRequest;
};


var commit = function (params, callback) {
	var patronEmail, stripeToken, daysUntilPayment, paymentDay, things, patron;
	var toMember = undefined;

	patronEmail = params.patronEmail;
	stripeToken = params.stripeToken;
	daysUntilPayment = params.daysUntilPayment;
	paymentDay = params.paymentDay;

	things = params.things;
	patron = params.patron;
	toUsername = params.toUsername;
	
	var success = function (patronId) {
		// TODO: Is patronId null?
		callback(null, patronId);
	};

	var failure = function (err) {
		callback(err);
	};

	// This is called after we save the contribution data (below).
	// Now we put the appropriate charges into the Stripe system.
	var doStripeStuff = function () {

		var stripe;
		if (toMember.stripeToken) {
			stripe = require('stripe')(toMember.stripeToken);
		}
		else {
			failure("Member does not have a connecteed Stripe account.");
			return;
		}

		// 1. See if our patron has a Stripe ID.
		if (patron.stripeIds && patron.stripeIds[toMember.id]) {
			// If they do, cool. That means they've been here before, 
			// and we need to update their subscription plan in Stripe.

			// Furthermore, Stripe doesn't allow us to edit subscriptions
			// once they've been created. That's fine. Let's delete
			// the active subscription, and create a new one with the
			// details that we want.
			var stripeId = patron.stripeIds[toMember.id];

			var createPlanAnew = function () {
				var planRequest = getStripePlanRequest(
									patron.id, toMember.id, things, daysUntilPayment);
				stripe.plans.create(planRequest, function (err, planResponse) {
					if (err) {
						failure(err);
						return;
					}
					else {
						// TODO: Do anything with the response?
						// Update the payment day and save to the database, 
						// since Stripe doesn't save it for us.
						patron.stripePaymentDays = patron.stripePaymentDays || {};
						patron.stripePaymentDays[toMember.id] = paymentDay;
						db.patrons.save(patron, success, failure);
					}
				});
			};

			var handleDeleteResponse = function (err, deleteResponse) {
				// Plan was deleted. Create plan anew.
				err ? failure(err) : createPlanAnew();
			};

			var deleteAndCreatePlan = function () {
				var stripePlanId = getStripePlanId(patron.id, toMember.id);
				stripe.plans.del(stripePlanId, handleDeleteResponse);
			};

			deleteAndCreatePlan();
		}
		else {
			// If the patron doesn't have a Stripe ID, cool. That 
			// means we need to create a customer for them in Stripe, 
			// create a subscription plan for them, and associate the two.
			var stripeCustomerCreated = function (customerResponse) {

				patron.stripeIds = patron.stripeIds || {};
				patron.stripeIds[toMember.id] = customerResponse.id;

				patron.stripePaymentDays = patron.stripePaymentDays || {};
				patron.stripePaymentDays[toMember.id] = paymentDay;
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
					description: patronEmail, 
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
				var planRequest = getStripePlanRequest(
									patron.id, toMember.id, things, daysUntilPayment);
				console.log("Creating plan ...");
				// TODO: If we get a failure at this point, we have a data
				// integrity issue, because it is likely a plan already exists.
				stripe.plans.create(planRequest, function (err, planResponse) {
					if (err && err.name === 'invalid_request_error') {
						// At this point, there is a plan in the Stripe 
						// database that our database doesn't know about.
						//
						// This is very bad, because there are existing, 
						// recurring charges that we don't know about.
						//
						// TODO: Freak out, appropriately.
					}
					err ? failure(err) : stripePlanCreated(planResponse);
				});
			};

			createPlanAndCustomer();
		};
	}

	// To save the contribution, we need to get the ID of
	// the person we're giving things to; we do so
	// via the username, which was in the request url.
	db.patrons.getByUsername(
		toUsername, 
		function (member) { 

			var onMemberSave = function() {
				// After saving the member in the backed
				// member data, save the contribution as its 
				// own document.
				// ... then do Stripe stuff
				var contribution = {};
				contribution.backerId = patron.id;
				contribution.memberId = member.id;
				contribution.things = things;
				db.contributions.save(contribution, doStripeStuff, failure);
			}

			// First, save the contribution in the member data. We
			// do this so we can create contribution views more easily,
			// at the expense of space.
			if (!member.backers[patron.id]) {
				member.backers[patron.id] = patron.id;
			}
			if (member.id === patron.id) {
				// In this special case, where a member is making a 
				// contribution to herself, just make one call to the
				// database, to avoid conflicts.
				if (!member.backing[member.id]) {
					member.backing[member.id] = member.id;
				}
			}
			else {
				// Save the contribution in the patron data. We do this
				// so we can create a view for who is backing a member.
				if (!patron.backing[member.id]) {
					patron.backing[member.id] = member.id;
					// We're doing this async and we don't need to know
					// when success occurs.
					// TODO: This makes error handling a little harder,
					// so think about what's up, now.
					db.patrons.save(patron, function() {}, failure);
				}
			}

			toMember = member;
			db.patrons.save(member, onMemberSave, failure);
		},
		failure
	);

	return;
};


var _handleConnectResponse = function (stripeResponse, patronEmail, callback) {
	// stripeResponse:
	// {
	//    state: 'whatever we sent',
	//    scope: 'read_write',
	//    code: 'woeifjlfjaljfweaoifjoiwuef'
	// }
	var data = qs.stringify({
		client_secret: apiKey,
		code: stripeResponse.code,
		grant_type: 'authorization_code'
	});

	var options = {
		host: 'connect.stripe.com',
		port: '443',
		path: '/oauth/token',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': data.length
		}
	};

	var postReq = https.request(options, function (postRes) {
		var postResBody = "";

		if (postRes.statusCode === 200) {
			postRes.setEncoding('utf8');
			postRes.on('data', function (chunk) {
				postResBody += chunk;
			});
			postRes.on('end', function() {
				var stripeAccess = JSON.parse(postResBody);
				var success = function() {
					callback(null);
				};
				var failure = function(err) {
					callback(err);
				};

				var gotPatron = function (patron) {
					patron.stripeToken = stripeAccess.access_token;
					db.patrons.save(patron, success, failure);
				};

				if (stripeAccess && stripeAccess.access_token) {
					db.patrons.get(patronEmail, gotPatron, failure);
				}
			});
		};
	});

	postReq.write(data);
	postReq.end();
	callback(null);
};

var commitOnce = function (toUsername, stripeToken, things, callback) {
	callback = callback || function(){};
	
	var priceNow = function (things) {
		var totalPrice = 0;

		things.forEach(function (thing) {
			if (thing.canHaz && !thing.recurring) {
				totalPrice += parseFloat(thing.price);
			}
		});

		return totalPrice.toFixed(2);
	};

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

	var success = function (member) {
		if (member.stripeToken) {
			var stripe = require('stripe')(member.stripeToken);
			stripe.charges.create(chargeRequest, function(err, chargeResponse) {
				if (err) {
					callback(err);
				}
				else {
					// Success! 
					callback(null, chargeResponse);
				}
			});
		}
		else {
			// member not found
			var error = {};
			error.code = 404;
			error.message = "Member not found.";
			callback(error);
		}
	};

	var failure = function (error) {
		callback(error);
	}

	db.patrons.getByUsername(toUsername, success, failure);
};

var getContributionDay = function (patron, member, callback) {
	var gotPatron = function (patron) {
		if (patron.stripePaymentDays && patron.stripePaymentDays[member.id]) {
			callback(null, patron.stripePaymentDays[member.id]);
		}
		else {
			callback("Contribution not found from " + 
				patron.id + " to " + member.id);
		}
	};

	// TODO: Do we need this? Maybe not.
	db.patrons.get(patron.id, gotPatron, callback);
};


// TODO: Consider whether to do this. Basically, a
// patron can have multiple Stripe customer ids, 
// which each get their own card. This should be
// figured out in the long run, but for the time
// being there are more important things.
//
// app.get('/card', function (req, res) {
// 	if (!req.user) {
// 		// 'Anonymous' doesn't have a card.
// 		res.send({});
// 		return;
// 	}

// 	var stripe = require('stripe')(apiKey);

// 	var failure = function (err) {
// 		console.log(err);
// 		// TODO: Figure out an error message scheme.
// 		res.send(500);
// 	};

// 	var success = function (patron) {
// 		if (!patron.stripeId) {
// 			res.send({});
// 			return;
// 		}
// 		stripe.customers.retrieve(patron.stripeId, function (err, customer) {
// 			if (err) {
// 				failure(err);
// 				return;
// 			}

// 			var card = {};
// 			if (customer.active_card 
// 				&& customer.active_card.type
// 				&& customer.active_card.last4) {
// 				card.type = customer.active_card.type;
// 				var last4 = customer.active_card.last4;
// 				card.lastDigit = last4.substring(last4.length - 1);
// 			}

// 			res.send(card);
// 		});
// 	};

// 	db.patrons.getByUsername(req.user.username, success, failure);
// });

exports.initialize = function(database, options) {
	if (options) {
		stripeTestClientId = options.stripeTestClientId || '';
		apiKey = options.apiKey || '';
	}
	db = database;
	return;
};

exports.perMonthMultiplier = perMonthMultiplier;
exports.commit = commit;
exports.commitOnce = commitOnce;
exports.getContributionDay = getContributionDay;
exports.stripe = {
	handleConnectResponse: _handleConnectResponse
};
