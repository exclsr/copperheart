//----------------------------------------------------
// database.js
//
// The thing that knows about our database implementation.
// The api is at the bottom.
//
var cradle = require('cradle');
var nanoo = require('./nanoo.js');
var defaultConfig  = require('../config.js').database();

var db = function (config) {

	var database;
	var dbConfig = config || defaultConfig;
	var useHttps = dbConfig.useHttps || false;

	var couchHost = (useHttps ? "https://" : "http://") + (dbConfig.host || 'localhost');
	var couchPort = dbConfig.port || 5984;
	var databaseName = dbConfig.name || 'sandbox';
	

	// TODO: Put retry stuff in here, as we'll be 
	// connecting to another computer in production.
	// See https://github.com/cloudhead/cradle#retry-on-connection-issues
	var cradleDb = function () {
		// We use cradle for view creation, primarily.
		var auth = undefined;
		if (dbConfig.username && dbConfig.password) {
			auth = { 
				username: dbConfig.username, 
				password: dbConfig.password
			};
		}
		var options = {
			cache: true,
			raw: false,
			secure: useHttps ? true : false,
			auth: auth
		};
		return new(cradle.Connection)(
			couchHost, couchPort, options
			).database(databaseName);
	}(); // closure
	
	var getContributionId = function (backerId, memberId) {
		return backerId + "-" + memberId;
	};


	var createViews = function (callback) {
		var designDocs = [];

		var maybeReady = function (designDoc) {
			var areAllDocsReady = true;
			
			designDoc.isReady = true;
			designDocs.forEach(function (doc) {
				if (!doc.isReady) {
					areAllDocsReady = false;
				}
			});

			if (areAllDocsReady) {
				callback();
			}
		};

		// TODO: 'profiles' isn't quite right, maybe.
		// Also, the attachments are a work in progress.
		var profilesDesignDoc = {
			url: '_design/profiles',
			body: 
			{
				version: "1.0.0",
				views: {
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
			}
		};
		designDocs.push(profilesDesignDoc);


		var patronsDesignDoc = {
			url: '_design/patrons',
			body: 
			{
				version: "1.0.0",
				views: {
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
			}
		};
		designDocs.push(patronsDesignDoc);


		var thingsDesignDoc = {
			url: '_design/things',
			body: 
			{
				version: "1.0.0",
				views: {
					byUsername: {
						map: function(doc) {
							if (doc.username) {
								emit(doc.username, doc.things || []);
							}
						}
					}
				}
			}
		};
		designDocs.push(thingsDesignDoc);


		var contributionsDesignDoc = {
			url: '_design/contributions',
			body: 
			{
				version: "1.0.0",
				views: {
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
			}
		};
		designDocs.push(contributionsDesignDoc)


		var saveDesignDocs = function () {
			var saveDoc = function (doc) {
				cradleDb.save(doc.url, doc.body, function() {
					maybeReady(doc);
				});
			};

			// Save our design doc if it doesn't exist or if
			// the version in the database is different from
			// the one we have in the code.
			designDocs.forEach(function (doc) {
				database.get(doc.url, function (err, body) {
					if (err && err['status-code'] === 404) {
						saveDoc(doc);	
					}
					else if (err) {
						callback(err);
					}
					else {
						if (body.version === doc.body.version) {
							// Up to date.
							maybeReady(doc);
						}
						else {
							saveDoc(doc);
						}
					}
				});
			});
		}(); // closure
	};


	var createDatabaseAndViews = function (callback) {
		cradleDb.exists(function (err, exists) {
			if (err) {
				callback(err);
				return;
			}
			
			if (exists) {
				createViews(callback);
			}
			else {
				nanoo.createDatabase(function (err) {
					if (err) {
						callback(err);
						return;
					}
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
			
			nanoo.processHeaders(headers);
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
				nanoo.processHeaders(headers);
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
								nanoo.processHeaders(headers);
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
							nanoo.processHeaders(headers);
							success();
						}
					});
				}
			},
			failure
		);
	};

	var deleteContribution = function(backerId, memberId, success, failure) {
		var removeDatabaseRecords = function (contribution, backer, member) {
			if (contribution.length < 1) {
				failure("Could not find contribution in database");
				return;
			}
			var contribution = contribution[0];
			console.log('removing contribution doc ...');
			database.destroy(contribution._id, contribution._rev, function (err) {
				if (err) {
					failure(err);
					return;
				}
				else {
					console.log('deleting properties ...');
					// Update the backer and member patron data, 
					// to remove the association between the two,
					// and the Stripe data.
					delete backer.backing[memberId];
					delete backer.stripeIds[memberId];
					delete backer.stripePaymentDays[memberId];
					delete member.backers[backerId];

					if (member.id === backer.id) {
						delete backer.backers[backerId];
						console.log('saving patron ...');
						savePatron(backer, success, failure);
					}
					else {
						savePatron(backer, function() {
							savePatron(member, success, failure);
						}, failure);
					}
				}
			});
		};

		console.log('getting contribution ...');
		getContribution(backerId, memberId, function (contribution) {
			console.log('getting backer ...');
			getPatronById(backerId, function (backer) {
				console.log('getting patron ...');
				getPatronById(memberId, function (member) {
					console.log('removing records ...');
					removeDatabaseRecords(contribution, backer, member);
				}, failure);
			}, failure);
		}, failure);
	};

	var streamImageAttachment = function (patron, attachmentName, headers, res, callback) {
		var docId = patron._id;

		var readStream;
		nanoo.getAttachmentStream(docId, attachmentName, headers, function (err, stream) {
			if (err) {
				callback(err);
				// TODO: return?
			}
			else {
				readStream = stream;
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
		var nanooConfig = {
			databaseUrl: couchHost + ':' + couchPort,
			databaseName: databaseName,
			username: dbConfig.username,
			password: dbConfig.password
		};

		nanoo.init(nanooConfig);
		nanoo.connect(function (nano) {
			// TODO: This is a symptom of a design
			// that can be improved inside nanoo.
			database = nano;
			createDatabaseAndViews(function (err) {
				callback(err);
			});
		});
	};

	return {
		relax: nanoo.refreshConnection,
		init : doInit,
		onlyForTest : {
			destroy : nanoo.destroyDatabase
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
			save : saveContribution,
			'delete': deleteContribution 
		}
	};
};

exports.db = db;