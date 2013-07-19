//----------------------------------------------------
// database.js
//
// The thing that knows about our database implementation.
// The api is at the bottom.
//
var cradle = require('cradle');
var nano = require('nano');
var defaultConfig  = require('../config.js').database();

var db = function (config) {

	var dbConfig = config || defaultConfig;
	var couchHost = dbConfig.host || 'http://localhost';
	var couchPort = dbConfig.port || 5984;
	var databaseName = dbConfig.name || 'sandbox';

	var database;
	var cradleDb;
716
	// Connect to Couch! 
	// TODO: Put retry stuff in here, as we'll be 
	// connecting to another computer in production.
	// See https://github.com/cloudhead/cradle#retry-on-connection-issues
	// TODO: Maybe the 'useAuthentication' flag is silly.
	if (dbConfig.useAuthentication) {
		cradleDb = new(cradle.Connection)(
			dbConfig.secureHost || couchHost, 
			dbConfig.securePort || couchPort, 
			{
				cache: true,
				raw: false,
				secure: true,
				auth: { 
					username: dbConfig.username, 
					password: dbConfig.password
				}
			}
		).database(databaseName);
	}
	else {
		cradleDb = new(cradle.Connection)(
			couchHost, 
			couchPort, 
			{
				cache: true,
				raw: false
			}
		).database(databaseName);
	}

	// TODO: This initializes our database. Should
	// rename the method.
	var cookieToken;
	var handleNewCouchCookie = function (headers) {
		var dbUrl = couchHost + ':' + couchPort;

		if (headers && headers['set-cookie']) {
			cookieToken = headers['set-cookie'];
		}

		// TODO: do we want this useAuth flag?
		if ((dbConfig.useAuthentication || dbConfig.useCookies) 
			&& cookieToken) {
			database = nano({
				url: dbUrl,
				cookie: cookieToken
			}).use(databaseName);
		}
	};


	var dbUrl = couchHost + ':' + couchPort;
	// TODO: Use https when necessary. Most of the data
	// in our database is meant for the public, but there is 
	// definitely private data as well, such as email 
	// addresses ... I guess emails are about it, as the
	// stripe customer IDs are useless without our api keys. 
	// 
	// if (dbConfig.useAuthentication) {
	// 	dbUrl = dbConfig.secureHost + ':' + dbConfig.securePort;
	// }
	var nanoDb = nano(dbUrl);
	
	var getCookieToken = function (callback) {
		nanoDb.auth(dbConfig.username, dbConfig.password, 
			function (err, body, headers) {
				if (err) {
					// TODO: Freak out.
					console.log("Failed to get cookie token");
					console.log(err);
					return;
				}
				handleNewCouchCookie(headers);
				if (callback) {
					callback();
				}
			}
		);
	};

	// Connect to the database, callback with the response.
	// Can be useful for debugging.
	var doRelax = function (callback) {
		var headers = {
			"X-CouchDB-WWW-Authenticate": "Cookie",
			cookie: cookieToken
		};

		var opts = {
			db: databaseName,
			path: '',
			headers: headers
		};

		nanoDb.relax(opts, function (error, response, headers) {
			if (error) {
				if (error['status-code'] === 401) {
					// Unauthorized. 
					// TODO: Review logs to see if we need this.
					console.log("Called reauth from relax.");
					getCookieToken();
				}
			}
			else {
				handleNewCouchCookie(headers);
			}

			if (callback) {
				callback(error, response, headers);
			}
		});
	};

	var keepDatabaseServerActive = function() {
		// So, our database host likes to go to sleep if it feels
		// there is nothing important to do, resulting in 50-second
		// response times, or in some cases timing out after a minute,
		// and giving us 500 errors.

		var fiveMinutes = 5 * 60 * 1000;
		setInterval(doRelax, fiveMinutes);

		var reauth = function() {
			getCookieToken();
		};

		// Reauthorize with the server every twelve hours.
		// TODO: This is obviously a bad design. Get a handle
		// on what is actually happening.
		var twelveHours = 12 * 60 * 60 * 1000;
		setInterval(reauth, twelveHours);
	};

	var establishDatabaseConnection = function (callback) {

		var ready = function() {
			keepDatabaseServerActive();
			if (callback) {
				callback();
			}
		}

		if (dbConfig.useAuthentication || dbConfig.useCookies) {
			getCookieToken(ready);
		}
		else {
			database = nano({
				url: dbUrl
			}).use(databaseName);
			ready();
		}
	};


	var getContributionId = function (backerId, memberId) {
		return backerId + "-" + memberId;
	};


	var createViews = function (callback) {

		var isDesignDocReady = {
			profiles: false,
			patrons: false,
			things: false,
			contributions: false
		};

		var maybeReady = function (readyDocName) {
			isDesignDocReady[readyDocName] = true;
			for (doc in isDesignDocReady) {
				if (!isDesignDocReady[doc]) {
					return;
				}
			}
			callback();
		};

		// TODO: 'profiles' isn't quite right, maybe.
		// Also, the attachments are a work in progress.
		var profilesDesignDoc = {
			url: '_design/profiles',
			body: 
			{
				byUsername: {
					map: function(doc) {
						if (doc.username) {
							var profile = {};
							profile.name = doc.name;
							profile.communities = doc.communities || [];
							profile.username = doc.username;
							if (doc._attachments && doc._attachments["profile.jpg"]) {
								profile.image = doc._attachments["profile.jpg"];
							} 
							
							emit(doc.username, profile);
						}
					}
				}
			}
      	};

		var forceProfilesDesignDocSave = false;

		cradleDb.get(profilesDesignDoc.url, function (err, doc) {
			if (err || !doc.views 
				|| !doc.views.byUsername
				|| forceProfilesDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				cradleDb.save(profilesDesignDoc.url, profilesDesignDoc.body, 
					function() {
						maybeReady("profiles");
					}); 
			}
			else {
				maybeReady("profiles");
			}
		});


		var patronsDesignDoc = {
			url: '_design/patrons',
			body: 
			{
				byEmail: {
					map: function(doc) {
						if (doc.email) {
							// TODO: Be explicit about the data
							// we return -- don't just return the
							// entire document -- or maybe just
							// don't return the things that could
							// be large, like the list of backers?
							emit(doc.email, doc);
						}
					}
				},
				byId: {
					map: function(doc) {
						if (doc.id) {
							emit(doc.id, doc);
						}
					}
				},
				byUsername: {
					map: function(doc) {
						if (doc.username) {
							emit(doc.username, doc);
						}
					}
				},
				backing: {
					map: function(doc) {
						var backer = doc;
						var displayName;

						if (doc.backing) {
							// TODO: Obviously localization implications
							displayName = backer.name || "anonymous";
							for (var memberId in doc.backing) {
								emit([memberId, displayName], displayName);
							}
						}
					}
				}
			}
		};

		// Create or update the design doc if something we 
		// want is missing.
		// TODO: This is lame.
		var forceDesignDocSave = false;

		cradleDb.get(patronsDesignDoc.url, function (err, doc) {
			if (err || !doc.views 
				|| !doc.views.byEmail
				|| !doc.views.byId
				|| !doc.views.byUsername
				|| !doc.views.backing
				|| forceDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				cradleDb.save(patronsDesignDoc.url, patronsDesignDoc.body, 
					function() {
						maybeReady("patrons");
					}
				); 
			}
			else {
				maybeReady("patrons");
			}
		});


		var thingsDesignDoc = {
			url: '_design/things',
			body: 
			{
				byUsername: {
					map: function(doc) {
						if (doc.username) {
							emit(doc.username, doc.things || []);
						}
					}
				}
			}
      	};

      	// Create or update the design doc if something we 
      	// want is missing.
      	// TODO: This is lame.
      	// TODO: This is lame AND it is duplicate code with 
      	// that stuff above.
      	var forceThingsDesignDocSave = false;

		cradleDb.get(thingsDesignDoc.url, function (err, doc) {
			if (err || !doc.views 
				|| !doc.views.byUsername
				|| forceThingsDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				cradleDb.save(thingsDesignDoc.url, thingsDesignDoc.body,
					function() {
						maybeReady("things");
					}
				); 
			}
			else {
				maybeReady("things");
			}
		});


		var contributionsDesignDoc = {
			url: '_design/contributions',
			body: 
			{
				byPatronToProject: {
					// What contributions are being given from a specific
					// patron to a specific project?
					map: function(doc) {
						var getContributionId = function (backerId, memberId) {
							return backerId + "-" + memberId;
						};

						// TODO: Change this key to an array like so
						// [backerId, memberId]
						if (doc.type 
						 && doc.backerId
						 && doc.memberId
						 && doc.type === "contribution") { 
						 	var id = getContributionId(doc.backerId, doc.memberId);
							emit(id, doc);
						}
					}
				},

				byPatron: {
					// What are all the contributions that a specific 
					// patron is providing?
					map: function(doc) {
						if (doc.id) {
							// the patron we're looking for
							// emit([doc.id, 0], doc);

							// doc === the profiles of the projects we're backing
							// TODO: We don't really need the entire profile
							// here. Probably just the name.
							//
							// TODO: Maybe have a 'basic info' section in the doc
							// that contains name and username, and can be expanded
							// with messing with the view.
							for (var backerId in doc.backers) {
								emit([backerId, doc.id, 0], doc);
							}
						}

						// the patron's contributions
						if (doc.type === "contribution") { 
							emit([doc.backerId, doc.memberId, 1], doc);
						}
					}
				},

				toMember: {
					// What are all the contributions that a specific 
					// member is receiving?
					map: function(doc) {
						// if (doc.id) {
						// 	// for each backer, we want to know his or her name.

						// 	// doc === the profiles of the projects we're backing
						// 	// TODO: We don't really need the entire profile
						// 	// here. Probably just the name.
						// 	//
						// 	// TODO: Maybe have a 'basic info' section in the doc
						// 	// that contains name and username, and can be expanded
						// 	// with messing with the view.
						// 	for (var backerId in doc.backers) {
						// 		emit([backerId, doc.id, 0], doc);
						// 	}
						// }


						// the contributions to the member
						if (doc.type === "contribution") { 
							emit([doc.memberId, doc.backerId], doc);
						}
					}
				}
			}
      	};

      	// Create or update the design doc if something we 
      	// want is missing.
      	// TODO: This is lame.
      	// TODO: This is lame AND it is triplicate code with 
      	// that stuff above.
      	var forceContributionsDesignDocSave = false;

		cradleDb.get(contributionsDesignDoc.url, function (err, doc) {
			if (err || !doc.views 
				|| !doc.views.byPatronToProject
				|| !doc.views.byPatron
				|| !doc.views.toMember
				|| forceContributionsDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				cradleDb.save(contributionsDesignDoc.url, contributionsDesignDoc.body, 
					function() {
						maybeReady("contributions");
					}
				); 
			}
			else {
				maybeReady("contributions");
			}
		});
	};

	var createDatabaseAndViews = function (callback) {
		// Create database! We use cradle to create
		// our database and views, as it's a little
		// easier than via nano.
		cradleDb.exists(function (err, exists) {
			if (err) {
				throw (err);
			}
			else if (exists) {
				createViews(callback);
			}
			else {
				nanoDb.db.create(databaseName, function() {
					createViews(callback);
				});
			}
		});
	};

	// For performance testing, for the time being
	var log = function (d, prefix) {
		var seconds = d.getSeconds();
		var millisecond = d.getMilliseconds();
		console.log(prefix + ": " + seconds + "." + millisecond);
	};

	var getView = function(viewUrl, success, failure, viewGenerationOptions) {

		var splitViewUrl = viewUrl.split('/');
		var designName = splitViewUrl[0];
		var viewName = splitViewUrl[1];

		database.view(designName, viewName, viewGenerationOptions, function (err, body, headers) {
			if (err) {
				failure(err);
				return;
			}
			
			handleNewCouchCookie(headers);
			// Return the first row only, if the flag is indicated.
			if (viewGenerationOptions 
			&& viewGenerationOptions.firstOnly 
			&& body.rows.length > 0) {
				// TODO: Ok, how should we really do something like this?
				// The semantics are inconsistent with the other way.
				success(body.rows[0].value);
				return;
			}

			var docs = [];
			body.rows.forEach(function (doc) {
				docs.push(doc.value);
			});

			success(docs);
		});
	};

	var saveDocument = function(doc, success, failure) {
		database.insert(doc, function (error, response, headers) {
			// TODO: What to do with response, if anything?
			if (error) {
				failure(error);
			}
			else {
				handleNewCouchCookie(headers);
				success();
			}
		});
	};

	var _all = function(success, failure) {
		getView('patrons/all', success, failure);
	};

	var profilesByUsername = function (success, failure, options) {
		getView('profiles/byUsername', success, failure, options);
	};

	var getProfileByUsername = function (username, success, failure) {
		var options = {}
		options.key = username;
		options.firstOnly = true;
		// options.attachments = true;
		profilesByUsername(success, failure, options);
	};

	var patronsById = function (success, failure, options) {
		getView('patrons/byId', success, failure, options);
	};

	var patronsByEmail = function (success, failure, options) {
		getView('patrons/byEmail', success, failure, options);
	};

	var patronsByUsername = function (success, failure, options) {
		getView('patrons/byUsername', success, failure, options);
	};

	var patronsBacking = function (success, failure, options) {
		getView('patrons/backing', success, failure, options);
	};

	var getPatron = function (patronEmail, success, failure) {
		var options = {
			key: patronEmail, 
			firstOnly: true
		};
		patronsByEmail(success, failure, options);
	};

	var getPatronById = function (patronId, success, failure) {
		patronsById(success, failure, {key: patronId, firstOnly: true});
	};

	var getPatronByUsername = function (username, success, failure) {
		patronsByUsername(success, failure, {key: username, firstOnly: true});
	};

	var getBackingNames = function (memberId, success, failure) {
		var options = {
			startkey: [memberId],
			endkey: [memberId, {}]
		};
		patronsBacking(success, failure, options);
	};

	var savePatron = function (patron, success, failure) {
		getPatron(patron.email, 
			function (existingPatron) {
				if (!existingPatron || existingPatron.length < 1) {
					// No existing patron. Create doc.
					saveDocument(patron, success, failure);
				}
				else {
					// TODO: Really need to set up a convention for 
					// accessing single objects in our database.
					// existingPatron = existingPatron[0];

					// Update the existing contribution.
					patron._id = existingPatron._id;
					patron._rev = existingPatron._rev;
					patron._attachments = existingPatron._attachments;

					database.insert(
						patron, 
						function (error, response, headers) {
							if (error) {
								console.log("Failure saving patron.");
								failure(error);
							} 
							else {
								handleNewCouchCookie(headers);
								success();
							}
						}
					);
				}
			},
			failure
		);
	};

	var thingsByUsername = function (success, failure, options) {
		getView('things/byUsername', success, failure, options);
	};

	var getThings = function (username, success, failure) {
		thingsByUsername(success, failure, {key: username, firstOnly: true});
	};

	var saveThings = function (username, things, success, failure) {
		var patronFound = function (patron) {
			patron.things = things;
			saveDocument(patron, success, failure);
		};
		patronsByUsername(patronFound, failure, {key: username, firstOnly: true});
	};

	var contributionsByRel = function (success, failure, options) {
		getView('contributions/byPatronToProject', success, failure, options);
	};

	var contributionsByPatron = function (success, failure, options) {
		getView('contributions/byPatron', success, failure, options); 
	};

	var contributionsToMember = function (success, failure, options) {
		getView('contributions/toMember', success, failure, options); 
	};

	var getContributionsByPatron = function (backerId, success, failure) {
		var options = {
			startkey: [backerId],
			endkey: [backerId, {}, 3]
		};
		contributionsByPatron(success, failure, options);
	};

	var getContributionsToMember = function (memberId, success, failure) {
		var options = {
			startkey: [memberId],
			endkey: [memberId, {}]
		};
		contributionsToMember(success, failure, options);
	}

	var getContribution = function(backerId, memberId, success, failure) {
		var id = getContributionId(backerId, memberId);
		contributionsByRel(success, failure, {key: id});
	};

	var saveContribution = function(contribution, success, failure) {
		contribution.type = "contribution";

		getContribution(contribution.backerId, contribution.memberId,
			function (existingContribution) {
				if (!existingContribution || existingContribution.length < 1) {
					// No existing contribution. Create doc.
					saveDocument(contribution, success, failure);
				}
				else {
					// TODO: Really need to set up a convention for 
					// accessing single objects in our database.
					existingContribution = existingContribution[0];

					// Update the existing contribution.
					contribution._id = existingContribution._id;
					contribution._rev = existingContribution._rev;
					database.insert(contribution, 
					function (error, response, headers) {
						if (error) { 
							failure(error);
						}
						else {
							handleNewCouchCookie(headers);
							success();
						}
					});
				}
			},
			failure
		);
	};

	var streamImageAttachment = function (patron, attachmentName, headers, res, callback) {
		var docId = patron._id;

		var _headers = {};
		if (dbConfig.useAuthentication) {
			_headers["X-CouchDB-WWW-Authenticate"] = "Cookie";
			_headers["cookie"] = cookieToken.toString();			
		}
		// TODO: This works for Chrome. Are there other browser behaviors
		// that we need to care about?
		_headers["if-none-match"] = headers["if-none-match"];

		var attName = encodeURIComponent(attachmentName);
		var opts = {
			db: databaseName,
			headers: _headers,
			method: "GET",
			doc: docId,
			params: {},
			att: attName,
			encoding: null
		};

		var readStream = nanoDb.relax(opts, function (err) {
			if (err) {
				callback(err);
			}
		});


		// We access the database via getPatronByUsername right before
		// making this call, so we don't have to refresh our cookies.
		// TODO: We should check anyway. Check the docs to see if headers
		// are returned in this callback, or what.
		// readStream = database.attachment.get(docId, attachmentName, function (err) {
		// 	if (err) {
		// 		callback(err);
		// 	}
		// });

		// TODO: Consider setting 'end' to false so we can
		// maybe send an error code if we mess up.

		// Stream the image to 'res'
		res.type("image/jpeg");
		readStream.pipe(res);
	};

	var getImageByUsername = function (username, attachmentName, headers, res, callback) {
		var gotPatron = function (patron) {
			streamImageAttachment(patron, attachmentName, headers, res, callback);
		};

		var failure = function (err) {
			callback(err);
		};

		getPatronByUsername(username, gotPatron, failure);
	};

	var getProfileImageByUsername = function (username, headers, res, callback) {
		getImageByUsername(username, "profile.jpg", headers, res, callback);
	};

	var saveImageByUsername = function (username, attachmentName, imageData, callback) {
		var gotPatron = function (patron) {
			var docId  = patron._id;
			var docRev = patron._rev;
			var contentType = "image/jpeg";

			var options = {
				rev: docRev
			};

			database.attachment.insert(docId, attachmentName, imageData, 
				contentType, options, function (err) {
				if (err) {
					callback(err);
				}
				else {
					callback();
				}
			});
		};

		var failure = function (err) {
			callback(err);
		};

		getPatronByUsername(username, gotPatron, failure);
	};

	var saveProfileImageByUsername = function(username, imageData, callback) {
		saveImageByUsername(username, "profile.jpg", imageData, callback);
	};


	var getBackgroundImageByUsername = function (username, headers, res, callback) {
		getImageByUsername(username, "background.jpg", headers, res, callback);
	};

	var saveBackgroundImageByUsername = function(username, imageData, callback) {
		saveImageByUsername(username, "background.jpg", imageData, callback);
	};


	var getFutureImageByUsername = function (username, headers, res, callback) {
		getImageByUsername(username, "future.jpg", headers, res, callback);
	};

	var saveFutureImageByUsername = function(username, imageData, callback) {
		saveImageByUsername(username, "future.jpg", imageData, callback);
	};


	var sanitizeName = function (name) {
		// TODO: sanitize name.
		return name;
	}

	var getCommunityImageByUsername = function (username, communityName, headers, res, callback) {
		var name = sanitizeName(communityName);
		getImageByUsername(username, name + ".jpg", headers, res, callback);
	};

	var saveCommunityImageByUsername = function (username, communityName, imageData, callback) {
		var name = sanitizeName(communityName);
		saveImageByUsername(username, name + ".jpg", imageData, callback);
	};

	var getCommunityIconByUsername = function (username, communityName, headers, res, callback) {
		var name = sanitizeName(communityName);
		getImageByUsername(username, name + "icon.jpg", headers, res, callback);
	};

	var saveCommunityIconByUsername = function (username, communityName, imageData, callback) {
		var name = sanitizeName(communityName);
		saveImageByUsername(username, name + "icon.jpg", imageData, callback);
	};

	var doInit = function (callback) {
		createDatabaseAndViews(function() {
			establishDatabaseConnection(callback);
		});
	};

	// TODO: This is only for testing. Where should this code be?
	var doDestroy = function (callback) {
		nanoDb.db.destroy(databaseName, callback);
	};

	return {
		relax: doRelax,
		init : doInit,
		onlyForTest : {
			destroy : doDestroy
		},
		profileImages : {
			get : getProfileImageByUsername,
			save : saveProfileImageByUsername,
			getBackground : getBackgroundImageByUsername,
			saveBackground : saveBackgroundImageByUsername,
			getFuture : getFutureImageByUsername,
			saveFuture : saveFutureImageByUsername
		},
		profiles : {
			getByUsername : getProfileByUsername
		},
		communityImages : {
			get : getCommunityImageByUsername,
			save: saveCommunityImageByUsername,
			getIcon : getCommunityIconByUsername,
			saveIcon : saveCommunityIconByUsername
		},
		patrons : {
			get : getPatron,
			getById : getPatronById,
			getByUsername : getPatronByUsername,
			getBacking : getBackingNames,
			save : savePatron
		},
		things : {
			get : getThings,
			save : saveThings
		},
		contributions : {
			get : getContribution,
			getByPatronId : getContributionsByPatron,
			getToMemberId : getContributionsToMember,
			save : saveContribution
		}
	};
};

exports.db = db;