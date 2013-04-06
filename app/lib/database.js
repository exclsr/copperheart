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

	var createViews = function() {

		var patronsDesignDoc = {
			url: '_design/patrons',
			body: 
			{
				all: {
					map: function(doc) {
						if (doc.name) {
							emit(doc.name, doc);
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
				|| !doc.views.all
				|| forceDesignDocSave) {
				// TODO: Add a mechanism for knowing when views
				// themselves have updated, to save again at the
				// appropriate times.
				database.save(patronsDesignDoc.url, patronsDesignDoc.body); 
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
				console.log(error);
				failure(error);
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

	var getPatron = function (patronId, success, failure) {
		database.get(patronId, function (error, response) {
			// TODO: Make sure this is the right data.
			error ? failure(error) : success(response);
		});
	};

	var savePatron = function (patron, success, failure) {
		database.save(patron.id, patron, function (error, response) {
			// TODO: What to do with response, if anything?
			error ? failure(error) : success();
		});
	};

	createDatabaseAndViews();
	return {
		patrons : {
			get : getPatron,
			save : savePatron
		}
	};
}(); // closure

exports.db = db;