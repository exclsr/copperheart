//----------------------------------------------------
// database.js
//
// The thing that knows about our database implementation.
//
var cradle = require('cradle');
var nano = require('nano');

var db = function() {

	// TODO: Sandbox vs production database.
	var couchHost = 'http://localhost';
	var couchPort = 5984;
	
	var databaseName = 'sandbox';

	var database;
	var cradleDb;
	var isUsingCradle = false;
	// Connect to Couch! 
	// TODO: Put retry stuff in here, as we'll be 
	// connecting to another computer in production.
	// See https://github.com/cloudhead/cradle#retry-on-connection-issues
	cradleDb = new(cradle.Connection)(couchHost, couchPort, {
		cache: true,
		raw: false
	}).database(databaseName);

	if (isUsingCradle) {
		database = cradleDb;
	}
	else {
		var host = couchHost + ':' + couchPort;
		var n = nano(host);
		var cookieToken = "";
		var callback = function() {
			database = nano({
				url: couchHost + ':' + couchPort //,
				//cookie: cookieToken
			}).use(databaseName);
		};
		
		var getCookieToken = function (callback) {
			// TODO: Need to refresh cookie when appropriate.
			n.auth(dbAuth.username, dbAuth.password, 
				function (err, body, headers) {
					if (err) {
						// TODO: Freak out.
						callback(err);
						return;
					}

					if (headers && headers['set-cookie']) {
						cookieToken = headers['set-cookie'];
					}

				callback();
			});
		};

		// TODO: Set up nano to use cookies for auth.
		// getCookieToken(callback);
		callback();
	}

	var getContributionId = function (backerId, projectId) {
		return backerId + "-" + projectId;
	};

	var createViews = function() {

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
				cradleDb.save(profilesDesignDoc.url, profilesDesignDoc.body); 
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
				|| forceDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				cradleDb.save(patronsDesignDoc.url, patronsDesignDoc.body); 
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
				cradleDb.save(thingsDesignDoc.url, thingsDesignDoc.body); 
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
						var getContributionId = function (backerId, projectId) {
							return backerId + "-" + projectId;
						};

						// TODO: Change this key to an array like so
						// [backerId, projectId]
						if (doc.type 
						 && doc.backerId
						 && doc.projectId
						 && doc.type === "contribution") { 
						 	var id = getContributionId(doc.backerId, doc.projectId);
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
							emit([doc.backerId, doc.projectId, 1], doc);
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
				|| forceContributionsDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				cradleDb.save(contributionsDesignDoc.url, contributionsDesignDoc.body); 
			}
		});
	};

	var createDatabaseAndViews = function() {
		// Create database! We use cradle to create
		// our database and views, as it's a little
		// easier than via nano.
		cradleDb.exists(function (err, exists) {
			if (err) {
				throw (err);
			}
			else if (exists) {
				createViews();
			}
			else {
				cradleDb.create();
				createViews();
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

		if (!isUsingCradle) {
			var foo = viewUrl.split('/');
			var designName = foo[0];
			var viewName = foo[1];

			log(new Date(), 'before view'); // TODO: Hack
			database.view(designName, viewName, viewGenerationOptions, function(err, body) {
				if (err) {
					failure(err);
					return;
				}

				// Return the first row only, if the flag is indicated.
				if (viewGenerationOptions 
				&& viewGenerationOptions.firstOnly 
				&& body.rows.length > 0) {
					// TODO: Ok, how should we really do something like this?
					// The semantics are inconsistent with the other way.
					log(new Date(), 'success view'); // TODO: Hack
					success(body.rows[0].value);
					return;
				}

				var docs = [];
				body.rows.forEach(function (doc) {
					docs.push(doc.value);
				});

				success(docs);
			});
		}
		else {
			log(new Date(), 'before view'); // TODO: Hack
			database.view(viewUrl, viewGenerationOptions, function (error, response) {
				if (error) {
					failure(error);
					return;
				}

				// Return the first row only, if the flag is indicated.
				if (viewGenerationOptions 
				&& viewGenerationOptions.firstOnly 
				&& response.length > 0) {
					// TODO: Ok, how should we really do something like this?
					// The semantics are inconsistent with the other way.
					log(new Date(), 'success view'); // TODO: Hack
					success(response[0].value);
					return;
				}

				var docs = [];
				response.forEach(function (row) {
					docs.push(row);
				});

				success(docs);
			});
		}
	};

	var saveDocument = function(doc, success, failure) {
		if (isUsingCradle) {
			database.save(doc, function (error, response) {
				// TODO: What to do with response, if anything?
				error ? failure(error) : success();
			});
		}
		else {
			database.insert(doc, function (error, response) {
				// TODO: What to do with response, if anything?
				error ? failure(error) : success();
			});
		}
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

	var getPatron = function (patronEmail, success, failure) {
		patronsByEmail(success, failure, {key: patronEmail, firstOnly: true});
	};

	var getPatronById = function (patronId, success, failure) {
		patronsById(success, failure, {key: patronId, firstOnly: true});
	};

	var getPatronByUsername = function (username, success, failure) {
		patronsByUsername(success, failure, {key: username, firstOnly: true});
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
					if (isUsingCradle) {
						database.save(existingPatron._id, existingPatron._rev,
							patron, 
							function (error, response) {
								error ? failure(error) : success();
							});
					}
					else {
						patron._rev = existingPatron._rev;
						database.insert(patron, 
						function (error, response) {
							error ? failure(error) : success();
						});
					}
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
	}

	var getContributionsByPatron = function (backerId, success, failure) {
		var options = {
			startkey: [backerId],
			endkey: [backerId, {}, 3]
		};
		contributionsByPatron(success, failure, options);
	}

	var getContribution = function(backerId, projectId, success, failure) {
		var id = getContributionId(backerId, projectId);
		contributionsByRel(success, failure, {key: id});
	};

	var saveContribution = function(contribution, success, failure) {
		contribution.type = "contribution";

		getContribution(contribution.backerId, contribution.projectId,
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
					if (isUsingCradle) {
						database.save(existingContribution._id, existingContribution._rev,
							contribution, 
							function (error, response) {
								error ? failure(error) : success();
							});
					}
					else {
						// contribution._id = existingContribution._id;
						contribution._rev = existingContribution._rev;
						database.insert(contribution, 
						function (error, response) {
							error ? failure(error) : success();
						});
					}
				}
			},
			failure
		);
	};

	var getProfileImageByUsername = function(username, res, callback) {
		// Stream the profile image to 'res'

		var gotPatron = function (patron) {
			var docId = patron._id;
			var attachmentName = "profile.jpg";

			res.type("image/jpeg");
			var readStream;
			if (isUsingCradle) {
				readStream = database.getAttachment(docId, attachmentName, function (err) {
					if (err) {
						callback(err);
					}
				});
			}
			else {
				readStream = database.attachment.get(docId, attachmentName, function (err) {
					if (err) {
						callback(err);
					}
				});
			}

			// TODO: Consider setting 'end' to false so we can
			// maybe send an error code if we mess up.
			readStream.pipe(res);
		};

		var failure = function (err) {
			callback(err);
		}

		getPatronByUsername(username, gotPatron, failure);
	};

	createDatabaseAndViews();
	return {
		profileImages : {
			get : getProfileImageByUsername
		},
		profiles : {
			getByUsername : getProfileByUsername
		},
		patrons : {
			get : getPatron,
			getById : getPatronById,
			getByUsername : getPatronByUsername,
			save : savePatron
		},
		things : {
			get : getThings,
			save : saveThings
		},
		contributions : {
			get : getContribution,
			getByPatronId : getContributionsByPatron,
			save : saveContribution
		}
	};
}(); // closure

exports.db = db;