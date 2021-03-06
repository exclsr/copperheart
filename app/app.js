var express    = require('express')
	, db       = require('./lib/database.js').db()
	, staticDb = require('./lib/staticDatabase.js').db()
	, routes   = require('./routes')
	, user     = require('./routes/user')
	, entrance = require('./routes/entrance')
	, http     = require('http')
	, fs       = require('fs')
	, path     = require('path')
	, redis    = require('connect-redis')(express)
	, gm       = require('gm')
	, config   = require('./config.js')
	, auth     = require('./lib/auth.js')
	, payment  = require('./lib/payment.js')
	;

var app = express();

var forceHttps = function(req, res, next) {
	if(req.secure 
		|| req.headers['x-forwarded-proto'] === 'https' 
		|| req.host === "localhost") {
		return next();	
	}
	res.redirect('https://' + req.get('Host') + req.url);
};

app.configure(function(){
	app.set('port', config.port());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	app.use(forceHttps);
	app.use(express.compress());
	app.use(express.static(path.join(__dirname, 'public')));
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(auth.firstRun); // TODO: Auth ...
	// start-required for auth:
	// TODO: Consolidate these things somewhere appropriate.
	app.use(express.cookieParser());
});

app.configure('production', function() {
	app.use(express.session(
	{
		store: new redis(config.redis()),
		secret: config.sessionSecret()
	}));
});

app.configure('development', function(){
	app.use(express.session({ secret: config.sessionSecret() }));
	app.use(express.errorHandler());
});

app.configure(function() {
	app.use(auth.initialize(db));
	app.use(auth.session());
	// end-required for auth.
	var apiKey = config.isProduction() ? config.stripeApiLive() : config.stripeApiTest();
	var paymentOptions = {
		apiKey: apiKey,
		stripeTestClientId: config.stripeTestClientId()
	}
	payment.initialize(db, paymentOptions);
	entrance.initialize(config);
	app.use(express.methodOverride());
	app.use(app.router);
});


app.get('/config/stripe-api-key', function (req, res) {
	var publicKey = config.isProduction() ? config.stripePublicLive() : config.stripePublicTest();
	res.send(publicKey);
});

app.get('/entrance/usernames', function (req, res) {
	res.send(config.entranceUsernames() || []);
});

//----------------------------------------------------------------
// Authentication
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


//----------------------------------------------------------------
// Patron data
//----------------------------------------------------------------
var anonymousPatron = "anonymous";

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

//----------------------------------------------------------------
// Patron private data
//----------------------------------------------------------------
app.get('/contributions/:toUsername/when', ensureAuthenticated, function (req, res) {
	var patron = req.user;

	var gotMember = function (member) {
		payment.getContributionDay(patron, member, function (err, data) {
			if (err) {
				console.log(err);
				res.send(500);
			}
			else {
				var paymentDay = "" + data;
				res.send(paymentDay);		
			}
		});
	};

	var failure = function (err) {
		console.log(err);
		res.send(500);
	};

	db.patrons.getByUsername(req.params.toUsername, gotMember, failure);
});

//----------------------------------------------------------------
// Patron-only actions
//----------------------------------------------------------------
app.put('/patron/who', ensureAuthenticated, function (req, res) {
	var patron = req.user;
	var who = req.body;

	var success = function (things) {
		req.user = auth.invalidateUser(req.user);
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
	db.patrons.save(patron, success, failure);
});


//----------------------------------------------------------------
// Public member data
//----------------------------------------------------------------
app.get('/things/:username', function (req, res) {

	var success = function (things) {
		if (!req.query.n || things.length === 0) {
			res.send(things);
		}
		else {
			// TODO: Consider doing this limitation at the data layer.
			var thingsCount = Math.min(things.length, req.query.n);
			res.send(things.slice(0, thingsCount));
		}
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	db.things.get(req.params.username, success, failure);
});


app.get('/support/:toUsername', function (req, res) {
	var success = function (data) {

		var things = {};
		data.forEach(function (contribution) {
			contribution.things.forEach(function (thing) {
				// TODO: Doesn't take into account things
				// with the same id and different prices.
				// ... or does it?
				if (things[thing.id]) {
					things[thing.id].count += payment.perMonthMultiplier(thing.frequency);
				}
				else {
					things[thing.id] = thing;
					things[thing.id].count = payment.perMonthMultiplier(thing.frequency);
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


app.get('/support/:toUsername/names', function (req, res) {
	
	var success = function(data) {
		res.send(data);
	};

	var failure = function (err) {
		console.log(err);
		res.send(500);
	};

	var gotMember = function (memberData) {
		db.patrons.getBacking(memberData.id, success, failure);
	};
	db.patrons.getByUsername(req.params.toUsername, gotMember, failure);
});


app.get('/who/:username', function (req, res) {
	var success = function (who) {
		var publicWho = {};
		publicWho.name = who.name || "";
		publicWho.present = who.present || "";
		publicWho.background = who.background || "";
		publicWho.future = who.future || "";
		publicWho.passions = who.passions || [];
		publicWho.communities = who.communities || [];
		publicWho.photoCredits = who.photoCredits || {};

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


//----------------------------------------------------------------
// Public member images
//----------------------------------------------------------------
app.get('/profile/:username/static-base-url', function (req, res) {

	var getImageUrlBase = function(memberId) {
		var dbConfig = config.database();
		var protocol = dbConfig.useHttps ? "https://" : "http://";
		var imageUrlBase = protocol + dbConfig.host + ":" + dbConfig.port 
			+ "/" + dbConfig.staticName + "/";

		return imageUrlBase + memberId + "/";
	};

	// Performance: Avoid a database trip if we can find the
	// static id in our entrance configuration.
	var entranceUsernames = config.entranceUsernames() || [];
	var entranceStaticIds = config.entranceStaticIds() || [];
	var index = entranceUsernames.indexOf(req.params.username);
	if (index >= 0 && entranceStaticIds.length > index) {
		res.send(getImageUrlBase(entranceStaticIds[index]));
	}
	else {
		// Slower but more robust way of doing this
		var gotMember = function (member) {
			var imageUrlBase = getImageUrlBase(member._id);	
			// TODO: Do we want to move more to the server side?
			res.send(imageUrlBase);
		};

		staticDb.getMember(req.params.username, gotMember, function (err) {
			console.log(err);
			res.send(500);
		});
	}
});

app.get('/profile/:username/image', function (req, res) {
	staticDb.profileImages.get(req.params.username, req.headers, res, function (err) {
		if (err) {
			// We don't have to do anything, here, as the db
			// pipe takes care of it. Log if you want.
			// res.send(404);
		}
	});
});

var noop = function () { };
app.get('/profile/:username/background/image', function (req, res) {
	staticDb.profileImages.getBackground(req.params.username, req.headers, res, noop);
});

app.get('/profile/:username/future/image', function (req, res) {
	staticDb.profileImages.getFuture(req.params.username, req.headers, res, noop);
});

var getCommunityImage = function (username, communityId, getImageFn, headers, res) {
	var success = function (profile) {
		if (!profile.communities) {
			res.send(404);
		}
		else {
			var community = profile.communities[communityId];
			if (community) {
				getImageFn(username, community.name, headers, res,
					function (err) {
						// We use pipes to transfer stuff, so we don't really
						// care about this error at the moment.
					}
				);
			}
			else {
				res.send(404); // not found
			}
		}
	};

	var failure = function (err) {
		console.log(err);
		res.send(500);
	};

	db.profiles.getByUsername(username, success, failure);
};

app.get('/profile/:username/community/:communityId/image', function (req, res) {
	getCommunityImage(
		req.params.username, 
		req.params.communityId, 
		staticDb.communityImages.get, 
		req.headers,
		res
	);
});

app.get('/profile/:username/community/:communityId/icon', function (req, res) {
	getCommunityImage(
		req.params.username, 
		req.params.communityId, 
		staticDb.communityImages.getIcon,
		req.headers,
		res
	);
});


//----------------------------------------------------------------
// Member-only actions
//----------------------------------------------------------------
app.get('/member', ensureIsMember, function (req, res) {
	// TODO: Maybe not do 'ensureIsMember' here, and instead
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
		member.background = memberData.background || "";
		member.future = memberData.future || "";
		member.passions = memberData.passions || [];
		member.communities = memberData.communities || [];
		member.photoCredits = memberData.photoCredits || {};
		// Don't transfer the actual token. We only care
		// if the member has associated their stripe account
		// with us.
		member.hasStripeAccount = memberData.stripeToken ? true : false;

		res.send(member);
	};

	db.patrons.get(req.user.email, gotMember, failure);
});


var saveMemberImage = function (options, callback) {
	var patron      = options.patron;
	var communityId = options.communityId;
	var filepath    = options.filepath;
	var saveImageFn = options.saveImageFn;
	var imageSize   = options.imageSize;

	var jsonError = {
		ok: false,
		error: {
			status: 500
		}
	};

	var community;
	if (communityId) {
		community = patron.communities[communityId];
		if (!community) {
			jsonError.error.status = 404;
			callback(jsonError);
			return;
		}
	}


	var imageWidth = imageSize.width ? imageSize.width : null;
	var imageHeight = imageSize.height ? imageSize.height : null;

	var saveCallback = function (err) {
		if (err) {
			console.log(err);
			callback(jsonError);
		}
		else {
			callback({ok: true});
		}
	};

	// TODO: Figure out how to just use streams 
	var newPath = filepath + '-new';
	var imageData = gm(filepath)
		.resize(imageWidth, imageHeight)
		.write(newPath, function (err) {

			if (err) {
				console.log(err);
				callback(jsonError);
			}
			else {
				fs.readFile(newPath, function (err, data) {
					if (err) {
						console.log(err);
						callback(jsonError);
					}
					else {
						if (community) {
							saveImageFn(patron.username, community.name, data, saveCallback);
						}
						else {
							saveImageFn(patron.username, data, saveCallback);
						}
					}
				});
			}
		});
};

app.post('/member/profileImage', ensureIsMember, function (req, res) {	
	var options = {
		patron: req.user,
		filepath: req.files.profileImage.path,
		saveImageFn: staticDb.profileImages.save,
		imageSize: {width: 300}
	};
	saveMemberImage(options, function (response) {
		res.send(response);
	});
});

app.post('/member/backgroundImage', ensureIsMember, function (req, res) {	
	var options = {
		patron: req.user, 
		filepath: req.files.backgroundImage.path,
		saveImageFn: staticDb.profileImages.saveBackground,
		imageSize: {width: 480, height: 270}
	};
	saveMemberImage(options, function (response) {
		res.send(response);
	});
});

app.post('/member/futureImage', ensureIsMember, function (req, res) {	
	var options = {
		patron: req.user, 
		filepath: req.files.futureImage.path,
		saveImageFn: staticDb.profileImages.saveFuture,
		imageSize: {width: 580, height: 270}
	};
	saveMemberImage(options, function (response) {
		res.send(response);
	});
});

// TODO: Refactor to be community/:id/image
app.post('/member/community/:communityId/image', ensureIsMember, function (req, res) {
	var options = {
		patron: req.user,
		communityId: req.params.communityId,
		filepath: req.files.communityImage.path,
		saveImageFn: staticDb.communityImages.save,
		imageSize: {width: 480, height: 270}
	};

	saveMemberImage(options, function (response) {
		res.send(response);
	});
});

app.post('/member/community/:communityId/icon', ensureIsMember, function (req, res) {
	var options = {
		patron: req.user,
		communityId: req.params.communityId,
		filepath: req.files.communityIcon.path,
		saveImageFn: staticDb.communityImages.saveIcon,
		imageSize: {width: 50, height: 50}
	};

	saveMemberImage(options, function (response) {
		res.send(response);
	});
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


var saveMember = function (member, req, res) {
	var success = function (data) {
		req.user = auth.invalidateUser(req.user);
		res.send("<3");
	};

	var failure = function (err) {
		console.log(err);
		// TODO: Figure out an error message scheme.
		res.send(500);
	};

	db.patrons.save(member, success, failure);
};

app.put('/member/who', ensureIsMember, function (req, res) {
	var member = req.user;
	var who = req.body;

	if (who.name !== undefined) {
		member.name = who.name;
	}
	if (who.present !== undefined) {
		member.present = who.present;
	}
	if (who.background !== undefined) {
		member.background = who.background;
	}
	if (who.future !== undefined) {
		member.future = who.future;
	}
	if (who.photoCredits !== undefined) {
		member.photoCredits = who.photoCredits;
	}

	saveMember(member, req, res);
});

app.put('/member/passions', ensureIsMember, function (req, res) {
	var member = req.user;
	member.passions = req.body;
	saveMember(member, req, res);
});

app.put('/member/communities', ensureIsMember, function (req, res) {
	var member = req.user;
	member.communities = req.body;
	saveMember(member, req, res);
});

app.put('/member/username', ensureIsMember, function (req, res) {
	var member = req.user;
	// TODO: Need to check for dups.
	// TODO: This messes up the entrance list, so be aware of that.
	staticDb.changeMemberUsername(member.username, req.body.username, function (err) {
		if (err) {
			console.log(err);
			res.send(500);
		}
		else {
			member.username = req.body.username;
			saveMember(member, req, res);	
		}
	});
});

app.put('/member/photo-credits', ensureIsMember, function (req, res) {
	var member = req.user;
	member.photoCredits = req.body;
	saveMember(member, req, res);
});


//----------------------------------------------------------------
// Commitments 
//----------------------------------------------------------------
app.put('/commit/once/:toUsername', function (req, res) {
	var stripeToken = req.body.stripeToken;
	var things = req.body.things;
	var toUsername = req.params.toUsername

	var handleResponse = function (err, response) {
		if (err) {
			console.log(err);
			if (error.code === 404) {
				res.send(404);
			}
			else {
				res.send(500);	
			}
		}
		else {
			console.log(response);
			res.send("<3");
		}
	};

	payment.commitOnce(toUsername, stripeToken, things, handleResponse);
});

app.put('/commit/stop', ensureAuthenticated, function (req, res) {
	var toUsername = req.body.username;
	var patronId = req.user.id;

	var params = {
		patronEmail: patronId,
		toUsername: toUsername
	};
	
	payment.stopCommit(params, function (err) {
		if (err) {
			console.log(err);
			res.send(500);
		}
		else {
			res.send("<3");
		}
	});
});

app.put('/commit/:toUsername', ensureAuthenticated, function (req, res) {
	var patronEmail = req.body.patronEmail;
	var serverSidePatronEmail = req.user.email;

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
	var params = {
		patronEmail: req.body.patronEmail,
		stripeToken: req.body.stripeToken,
		daysUntilPayment: req.body.daysUntilPayment,
		paymentDay: req.body.paymentDay,
		things: req.body.things,
		patron: req.user,
		toUsername: req.params.toUsername 
	};

	var handleResponse = function (err, patronId) {
		if (err) {
			console.log(err);
			res.send(500);
		}
		else {
			console.log(patronId);
			req.user = auth.invalidateUser(req.user);
			res.send("<3");
		}
	};

	payment.commit(params, handleResponse);
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


//----------------------------------------------------------------
// Stripe specifics
//----------------------------------------------------------------
// TODO: Why is this member only? What does this do?
app.get('/stripe/connect-client-id', ensureIsMember, function (req, res) {
	res.send(config.stripeConnectClientId());
});

// TODO: Why is this member only? What does this do?
app.get('/stripe/connect-response', ensureIsMember, function (req, res) {
	// TODO: Will this ever be called, with the 'ensureIsMember' middleware?
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
		// Stripe error. Neat.
		console.log(req.query.error);
		redirect();
	}
	else {
		var stripeResponse = req.query;
		var patronEmail = req.user.email;

		payment.stripe.handleConnectResponse(stripeResponse, patronEmail, function (err) {
			if (err) {
				console.log(err);
				redirect();
			}
			else {
				req.user = auth.invalidateUser(req.user);
			}
		});
	}
});

app.post('/stripe/webhook', function (req, res) {
	// don't realy care at this point.
	res.send("<3");
});


// Some day we'll use jade for basic templating. 
// For now, AngularJS in /public. 
// 
// app.get('/', routes.index);

// app.get('/users', user.list);

// TODO: Make this dev only
// app.get('/relax', function (req, res) {
// 	db.relax(function (error, response, headers) {
// 		if (error) {
// 			res.send(error);
// 		}
// 		else {
// 			res.send(response);
// 		}
// 	});
// });

app.get('/partials/entrance', entrance.index);

// Lastly ...
// This needs to be at the bottom, so things like
// /whoami, /card or /contributions still work.
app.get('/:username', function (req, res) {
	res.redirect("/#/hello/" + req.params.username);
});

// The secret to bridging Angular and Express in a 
// way that allows us to pass any path to the client.
app.get('*', routes.index);

http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
	var mode = "development";
	if (config.isProduction()) {
		mode = "production";
	}
	console.log("Mode: " + mode);
	db.init(function () {
		// TODO: Maybe show an error if things failed.
		console.log("Database: Ready");
	});
	staticDb.init(function () {
		console.log("Static Database: Ready");
	});
});
