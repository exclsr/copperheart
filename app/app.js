
/**
 * Module dependencies.
 */

var express = require('express')
	, routes  = require('./routes')
	, user    = require('./routes/user')
	, http    = require('http')
	, https   = require('https')
	, path    = require('path')
	, config  = require('./config.js')
	, auth    = require('./lib/auth.js')
	, db      = require('./lib/database.js').db
	, qs      = require('querystring');

var apiKey;
if (config.isProduction()) {
	apiKey = config.stripeApiLive(); 
}
else {
	apiKey = config.stripeApiTest();
}

var app = express();

app.configure(function(){
	app.set('port', config.port());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.compress());
	app.use(express.static(path.join(__dirname, 'public')));
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
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

app.get('/config/stripe-api-key', function (req, res) {
	if (config.isProduction()) {
		res.send(config.stripePublicLive());
	}
	else {
		res.send(config.stripePublicTest());
	}
});

app.get('/entrance/usernames', function (req, res) {
	res.send(config.entranceUsernames() || []);
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
var authMiddlewareSaveWhereFrom = 
	[
		function (req, res, next) {
			var rawFrom = req.query["from"] || "";
			// The encoded url stuff causes the auth redirect to fail,
			// so we decode what we know we're going to get, which is a
			// bit hack-ish, so feel free to have a better idea.
			var loginFrom = rawFrom.replace("%23", "#");
			req.session.loginFrom = loginFrom;
			next();
		},
		auth.authenticate('google', { failureRedirect: loginFailureUrl })
	];
app.get('/auth/google', 
	authMiddlewareSaveWhereFrom,
		function (req, res) {
			// This response doesn't matter, because we get redirected
			// to /auth/google/return anyway.
			res.send(':-)');
		}
);

// GET /auth/google/return
//   We get here when we're done authenticating through Google OpenID.
app.get(auth.googleReturnUrl, auth.authMiddleware, function (req, res) {
	if (req.isAuthenticated) {
		// TODO: Is this a security hole?
		res.redirect('/' + (req.session.loginFrom || ""));
	}
	else {
		// TODO: Do we want to go to the root on failure?
		// We might want to go to some login failure page.
		res.redirect('/');
	}
});

// Logout ...
app.get('/auth/signout', function (req, res){
	req.logout();
	res.send(204); // no content
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
	res.send(401, // unauthorized
		"To get a more desirable response," +
		" please first authenticate with the server," +
		" and try again.");
};

var getRole = function (user) {
	// TODO: What's an appropriate security permissions model?
	// TODO: Probably store the role in the database!
	// TODO: Make an admin page to manage roles and things.
	// TODO: This is clearly a hack job. Think about it a while.
	// ----- One idea is to /hasPermission/<role> and go from there.
	if (user) {
		var admins = config.adminEmailAddresses();
		var members = config.memberEmailAddresses();
		
		var adminFound = false;
		if (admins) {
			admins.forEach(function (adminEmailAddress) {
				if (adminEmailAddress === user.email) {
					adminFound = true;
					return;
				}
			});
		}

		if (adminFound) {
			return 'admin';
		}
		else {
			var memberFound = false;
			if (members) {
				members.forEach(function (memberEmailAddress) {
					if (memberEmailAddress === user.email) {
						memberFound = true;
						return;
					}
				});
			}
			if (memberFound) {
				return 'member';
			}
		}
		
		return 'patron';
	}
	else {
		return 'guest';
	}
};

var isMember = function(user) {
	var role = getRole(user);
	return (role === "admin" || role === "member");
}

// TODO: Can we refactor this a little, combining
// with ensureAuthenticated?
var ensureIsMember = function(req, res, next) {
	if (isMember(req.user)) {
		next();
		return;
	}
	
	res.send(401, // unauthorized
		"To get a more desirable response," +
		" please become a member," +
		" and try again.");
};

var invalidateUser = function (user) {
	// TODO: If performance is critical, an alternative to this
	// is just to save whatever is in db.patrons.save(user) into
	// req.user.
	user.refreshFromDatabase = true;
	return user;
};

var anonymousPatron = "anonymous";

// Patron data that patrons want to know about
// as they're wandering through the site.
app.get('/whoami/role', function (req, res) {
	res.send(getRole(req.user));
});

app.get('/whoami/id', function (req, res) {
	if (req.user) {
		var patron = req.user;
		res.send(patron.id);
	}
	else {
		res.send(anonymousPatron);
	}
});

app.get('/whoami', function (req, res) {
	if (req.user) {
		var failure = function (err) {
			console.log(err);
			// TODO: Figure out an error message scheme.
			res.send(500);
		};

		var gotPatron = function (patronData) {
			var patron = {};
			patron.email = patronData.email;
			patron.username = patronData.username;
			patron.name = patronData.name || "";

			res.send(patron);
		};

		db.patrons.get(req.user.email, gotPatron, failure);
	}
	else {
		res.send(anonymousPatron);
	}
});

app.get('/things/:username', function (req, res) {

	var success = function (things) {
		if (!req.query.n || things.length === 0) {
			res.send(things);
		}
		else {
			// TODO: Consider doing this limitation at the data layer.
			res.send(
				things.slice(
					0, 
					Math.min(
						things.length, 
						req.query.n)
				)
			);
		}
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	db.things.get(req.params.username, success, failure);
});

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

app.get('/support/:toUsername', function (req, res) {
	var success = function (data) {

		var things = {};
		data.forEach(function (contribution) {
			contribution.things.forEach(function (thing) {
				// TODO: Doesn't take into account things
				// with the same id and different prices.
				// ... or does it?
				if (things[thing.id]) {
					things[thing.id].count += perMonthMultiplier(thing.frequency);
				}
				else {
					things[thing.id] = thing;
					things[thing.id].count = perMonthMultiplier(thing.frequency);
				}
			});
		});
		res.send(things);
	};

	var failure = function (err) {
		console.log(err);
		res.send(500);
	};

	var gotMember = function (memberData) {
		db.contributions.getToMemberId(memberData.id, success, failure);
	};

	db.patrons.getByUsername(req.params.toUsername, gotMember, failure);
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
		if (rawContribution && rawContribution[0]) {
			var things = rawContribution[0].things;
			res.send(things);
		}
		else {
			res.send([]);
		}
	}

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	var gotMember = function (member) {
		db.contributions.get(patron.id, member.id, success, failure);
	};

	db.patrons.getByUsername(req.params.toUsername, gotMember, failure);
});

app.get('/contributions', function (req, res) {
	if (!req.user) {
		// 'Anonymous' doesn't have any contributions.
		res.send([]);
		return;
	}

	var patron = req.user;

	var success = function (rawResults) {
		var contributions = [];

		// TODO: This relies quite a bit on the structure
		// of the data. Is that what we want, here? This is
		// a great candidate to move inside the data API.
		if (rawResults) {
			var contribution = undefined;

			rawResults.forEach(function (rawResult) {
				// Things we know: We'll get a member profile
				// before we get the contributions to it.
				if (rawResult.id) {
					var member = {};
					member.name = rawResult.name;
					member.username = rawResult.username;

					contribution = {};
					contribution.member = member;
				}

				// Things we know: We'll get a contribution
				// right after we get a member profile.
				else if (rawResult.type === "contribution") {
					// If !contribution, there is a data issue, 
					// but it can happen.
					if (contribution) {
						contribution.things = rawResult.things;
						contributions.push(contribution);
					}
				}
			});
		}

		res.send(contributions);
	}

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	db.contributions.getByPatronId(patron.id, success, failure);
});


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

// Public data of a person
app.get('/who/:username', function (req, res) {
	var success = function (who) {
		var publicWho = {};
		publicWho.name = who.name || "";
		publicWho.present = who.present || "";
		publicWho.passions = who.passions || [];
		publicWho.communities = who.communities || [];

		res.send(publicWho);
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	db.patrons.getByUsername(req.params.username, success, failure);
});


app.get('/profile/:username', function (req, res) {
	var success = function (data) {
		var profile = {};
		profile.username = data.username;
		profile.name = data.name;
		profile.communities = data.communities;
		profile.image = data.image;

		res.send(profile);
	}

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	db.profiles.getByUsername(req.params.username, success, failure);
});

app.get('/profile/:username/image', function (req, res) {
	db.profileImages.get(req.params.username, res, function (err) {
		if (err) {
			res.send(404);
		}
	});
});

// Public and private data of a patron
// TODO: Rename? Yes, to 'member'
app.get('/member', ensureIsMember, function (req, res) {
	// TODO: Maybe not do 'ensureAuthenticated' here, and instead
	// send back something empty if we're not logged in, and have 
	// the client deal with that scenario.

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	var gotMember = function (memberData) {
		var member = {};
		member.email = memberData.email;
		member.username = memberData.username;
		member.things = memberData.things || [];
		member.name = memberData.name || "";
		member.present = memberData.present || "";
		member.passions = memberData.passions || [];
		member.communities = memberData.communities || [];
		// Don't transfer the actual token. We only care
		// if the member has associated their stripe account
		// with us.
		member.hasStripeAccount = memberData.stripeToken ? true : false;

		res.send(member);
	};

	db.patrons.get(req.user.email, gotMember, failure);
});

app.put('/member/things', ensureIsMember, function (req, res) {
	var member = req.user;
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
	// on the safe side? Yes! We need to strip out quotes
	// in the glyphs, for one. And, make sure we are only
	// putting in numbers for prices.
	db.things.save(member.username, things, success, failure);
});


app.put('/patron/who', ensureAuthenticated, function (req, res) {
	var patron = req.user;
	var who = req.body;

	var success = function (things) {
		req.user = invalidateUser(req.user);
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	if (who.name !== undefined) {
		patron.name = who.name;
	}
	if (who.present !== undefined) {
		patron.present = who.present;
	}

	db.patrons.save(patron, success, failure);
});

app.put('/member/passions', ensureIsMember, function (req, res) {
	// TODO: Obvi refactoring with the code above.
	var member = req.user;
	var passions = req.body;

	var success = function (things) {
		req.user = invalidateUser(req.user);
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	member.passions = passions;
	db.patrons.save(member, success, failure);
});


app.put('/member/communities', ensureIsMember, function (req, res) {
	// TODO: Obvi refactoring with the code above.
	var member = req.user;
	var communities = req.body;

	var success = function (things) {
		req.user = invalidateUser(req.user);
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	member.communities = communities;
	db.patrons.save(member, success, failure);
});


app.put('/member/username', ensureIsMember, function (req, res) {
	// TODO: Obvi refactoring with the code above.
	var member = req.user;
	var username = req.body.username;

	var success = function (things) {
		// TODO: When changing the username, we need to 
		// invalidate the passport user as well.
		req.user = invalidateUser(req.user);
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	// TODO: Need to check for dups.
	member.username = username;
	db.patrons.save(member, success, failure);
});




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


var getStripePlanId = function (patronId) {
	var planId = patronId + '-contribution';

	if (config.stripeTestClientId()) {
		planId += '-' + config.stripeTestClientId();
	}

	return planId;
};

// Some day we'll use jade for basic templating. 
// For now, AngularJS in /public. 
// 
// app.get('/', routes.index);
// app.get('/users', user.list);

// TODO: Figure out a way to share this price code
// on both the client and the server (if practical).

var getStripePlanRequest = function (patronId, things, daysUntilFirstPayment) {
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

	if (config.stripeTestClientId()) {
		planName += ' created by ' + config.stripeTestClientId();
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
		// TODO: calculate the trial period based on what day they want to pay.
		// maybe. need to figure out how plans are first charged. a better way
		// might be to just add things to a commit pool and take them out at
		// a scheduled time (as per client's config).
	};

	return planRequest;
};


app.put('/commit/once/:toUsername', function (req, res) {
	var stripeToken = req.body.stripeToken;
	var things = req.body.things;


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
					// TODO: Obviously ...
					console.log(err);
					res.send(500);
				}
				else {
					// Success! 
					console.log(chargeResponse);
					res.send("<3");
				}
			});
		}
		else {
			// member not found
			res.send(404);
		}
	};

	var failure = function (error) {
		console.log(error);
		res.send(500);
	}

	db.patrons.getByUsername(req.params.toUsername, success, failure);
});

app.put('/commit/:toUsername', ensureAuthenticated, function (req, res) {

	var patronEmail = req.body.patronEmail;
	var stripeToken = req.body.stripeToken;
	var daysUntilPayment = req.body.daysUntilPayment;
	var things = req.body.things;

	var patron = req.user;
	var toMember = undefined;
	var serverSidePatronEmail = patron.email;

	if (patronEmail !== serverSidePatronEmail) {
		res.send(412, // precondition failed
			"The patron name specified in your request does not match" +
			" who the server thinks is logged in." + 
			" Can you help us solve this mystery?");
		return;
	}
	// TODO NEXT: apiKey || access_token
	
	//
	// We are now authenticated, and have a user object.
	//
	var success = function (patronId) {
		if (patronId) {
			console.log(patronId);
		}
		
		req.user = invalidateUser(req.user);
		res.send("<3");
	}

	var failure = function (err) {
		console.log(err);
		res.send(500);
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
									patron.id, things, daysUntilPayment);
				stripe.plans.create(planRequest, function (err, planResponse) {
					// TODO: Do anything with the response?
					err ? failure(err) : success(patron.id);
				});
			};

			var handleDeleteResponse = function (err, deleteResponse) {
				// Plan was deleted. Create plan anew.
				err ? failure(err) : createPlanAnew();
			};

			var deleteAndCreatePlan = function () {
				var stripePlanId = getStripePlanId(patron.id);
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
									patron.id, things, daysUntilPayment);
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
		req.params.toUsername, 
		function (member) { 

			var onPatronSave = function() {
				// After saving the patron in the backed
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
			toMember = member;
			db.patrons.save(member, onPatronSave, failure);
		},
		failure
	);

	return;
});

app.get('/stripe/connect-client-id', ensureIsMember, function (req, res) {
	res.send(config.stripeConnectClientId());
});

app.get('/stripe/connect-response', ensureIsMember, function (req, res) {
	if (!isMember(req.user)) {
		// TODO: Redirect to a formal error page in this situation.
		res.send(401, // unauthorized
		"Hey. It looks like you signed out in the middle of your Stripe " +
		"authorization request.");
		return;
	}

	var redirect = function () {
		res.redirect('/#/edit');
	};

	if (req.query.error) {
		// Stripe error. Neat. No need to do anything.
		redirect();
	}
	else {
		// we get back:
		// {
		//    state: 'whatever we sent',
		//    scope: 'read_write',
		//    code: 'woeifjlfjaljfweaoifjoiwuef'
		// }
		var stripeResponse = req.query;

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
						req.user = invalidateUser(req.user);
					};
					var failure = function() {
						// TODO: ????
					};

					var gotPatron = function (patron) {
						patron.stripeToken = stripeAccess.access_token;
						db.patrons.save(patron, success, failure);
					};

					if (stripeAccess && stripeAccess.access_token) {
						db.patrons.get(req.user.email, gotPatron, failure);
					}
				});
			};
		});

		postReq.write(data);
		postReq.end();
		redirect();
	}
});

// TODO: Allow anonymous folks to send messages, too. Perhaps by way of email,
// or by saving them in the database under 'anonymous notes.''
app.put('/commit/:toUsername/note', ensureAuthenticated, function (req, res) {
	var patron = req.user;
	var note = req.body.note;
	var success = function() {
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		res.send(500);
	};

	var gotMember = function (member) {
		var gotContribution = function (rawContribution) {
			if (rawContribution && rawContribution[0]) {
				var contribution = rawContribution[0];
				contribution.note = note;
				db.contributions.save(contribution, success, failure);
			}
		};
		db.contributions.get(patron.id, member.id, gotContribution, failure);
	};
	db.patrons.getByUsername(req.params.toUsername, gotMember, failure);
});

app.post('/stripe/webhook', function (req, res) {
	// don't realy care at this point.
	res.send("<3");
});

// Lastly ...
// This needs to be at the bottom, so things like
// /whoami, /card or /contributions still work.
app.get('/:username', function (req, res) {
	res.redirect("/#/hello/" + req.params.username);
});

http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
	var mode = "development";
	if (config.isProduction()) {
		mode = "production";
	}
	console.log("Mode: " + mode);

});
