//----------------------------------------------------
// database.js
//
// The thing that knows about our database implementation.
//
var cradle = require('cradle');

var db = function() {

	// TODO: Sandbox vs production database.
	var couchHost = 'http://localhost';
	var couchPort = 5984;
	var databaseName = 'sandbox';

	// Connect to Couch! 
	// TODO: Put retry stuff in here, as we'll be 
	// connecting to another computer in production.
	// See https://github.com/cloudhead/cradle#retry-on-connection-issues
	var database = new(cradle.Connection)(couchHost, couchPort, {
		cache: true,
		raw: false
	}).database(databaseName);

	var getContributionId = function (backerId, projectId) {
		return backerId + "-" + projectId;
	};

	var createViews = function() {

		var patronsDesignDoc = {
			url: '_design/patrons',
			body: 
			{
				byEmail: {
					map: function(doc) {
						if (doc.email) {
							emit(doc.email, doc);
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

		database.get(patronsDesignDoc.url, function (err, doc) {
			if (err || !doc.views 
				|| !doc.views.byEmail
				|| !doc.views.byUsername
				|| forceDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				database.save(patronsDesignDoc.url, patronsDesignDoc.body); 
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

		database.get(thingsDesignDoc.url, function (err, doc) {
			if (err || !doc.views 
				|| !doc.views.byUsername
				|| forceThingsDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				database.save(thingsDesignDoc.url, thingsDesignDoc.body); 
			}
		});


		var contributionsDesignDoc = {
			url: '_design/contributions',
			body: 
			{
				byPatrons: {
					map: function(doc) {
						var getContributionId = function (backerId, projectId) {
							return backerId + "-" + projectId;
						};

						if (doc.type 
						 && doc.backerId
						 && doc.projectId
						 && doc.type === "contribution") { 
						 	var id = getContributionId(doc.backerId, doc.projectId);
							emit(id, doc);
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

		database.get(contributionsDesignDoc.url, function (err, doc) {
			if (err || !doc.views 
				|| !doc.views.byPatrons
				|| forceContributionsDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				database.save(contributionsDesignDoc.url, contributionsDesignDoc.body); 
			}
		});

	};

	var createDatabaseAndViews = function() {
		// Create database!
		database.exists(function (err, exists) {
			if (err) {
				throw (err);
			}
			else if (exists) {
				createViews();
			}
			else {
				database.create();
				createViews();
			}
		});
	};


	var getView = function(viewUrl, success, failure, viewGenerationOptions) {
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
				success(response[0].value);
				return;
			}

			var docs = [];
			response.forEach(function (row) {
				docs.push(row);
			});

			success(docs);
		});
	};

	var _all = function(success, failure) {
		getView('patrons/all', success, failure);
	};

	var patronsByEmail = function (success, failure, options) {
		getView('patrons/byEmail', success, failure, options);
	};

	var patronsByUsername = function (success, failure, options) {
		getView('patrons/byUsername', success, failure, options);
	};

	var getPatron = function (patronId, success, failure) {
		patronsByEmail(success, failure, {key: patronId, firstOnly: true});
	};

	var getPatronByUsername = function (username, success, failure) {
		patronsByUsername(success, failure, {key: username, firstOnly: true});
	};

	var savePatron = function (patron, success, failure) {
		database.save(patron, function (error, response) {
			// TODO: What to do with response, if anything?
			error ? failure(error) : success();
		});
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
			database.save(patron, function (error, response) {
				error ? failure(error) : success();
			})
		};
		patronsByUsername(patronFound, failure, {key: username, firstOnly: true});
	};

	var contributionsByRel = function (success, failure, options) {
		getView('contributions/byPatrons', success, failure, options);
	};

	var getContribution = function(backerId, projectId, success, failure) {
		var id = getContributionId(backerId, projectId);
		contributionsByRel(success, failure, {key: id});
	};

	var saveContribution = function(contribution, success, failure) {
		contribution.type = "contribution";

		getContribution(contribution.backerId, contribution.projectId,
			function (existingContribution) {
				if (!existingContribution || existingContribution === []) {
					// No existing contribution. Create doc.
					database.save(contribution, function (error, response) {
						error ? failure(error) : success();
					});
				}
				else {
					// TODO: Really need to set up a convention for 
					// accessing single objects in our database.
					existingContribution = existingContribution[0];
					// Update the existing contribution.
					database.save(existingContribution._id, existingContribution._rev,
						contribution, 
						function (error, response) {
							error ? failure(error) : success();
						});
				}
			},
			failure
		);
	};

	createDatabaseAndViews();
	return {
		patrons : {
			get : getPatron,
			getByUsername : getPatronByUsername,
			save : savePatron
		},
		things : {
			get : getThings,
			save : saveThings
		},
		contributions : {
			get : getContribution,
			save : saveContribution
		}
	};
}(); // closure

exports.db = db;