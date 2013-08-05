// views.js
//
// The design docs and views specific to Copper Heart.

var createViews = function (database, callback) {
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
			language: "javascript",
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
			language: "javascript",
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
			language: "javascript",
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
			language: "javascript",
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
			database.insert(doc.body, doc.url, function (err, body) {
				if (err && err['status-code'] === 409) {
					// document conflict (always happens if doc exists)
					database.get(doc.url, function (err, body) {
						if (err) {
							callback(err);
						}
						else {
							doc.body._id = body._id;
							doc.body._rev = body._rev;
							saveDoc(doc);
						}
					});
				}
				else if (err) {
					callback(err);
				}
				else {
					maybeReady(doc);
				}
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

exports.create = createViews;