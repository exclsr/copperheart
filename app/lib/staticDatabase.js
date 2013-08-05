var nanoo = require('./nanoo.js')();
var views = require('./staticViews.js');
var defaultConfig  = require('../config.js').database();

var db = function (config) {

	var database;
	var dbConfig = config || defaultConfig;
	var useHttps = dbConfig.useHttps || false;

	var couchHost = (useHttps ? "https://" : "http://") + (dbConfig.host || 'localhost');
	var couchPort = dbConfig.port || 5984;
	var databaseName = dbConfig.staticName || 'sandbox-static';
	
	var createDatabaseAndViews = function (callback) {
		nanoo.ensureExists(function (err) {
			if (err) {
				callback(err);
			}
			else {
				views.create(database, callback);
			}
		});
	};

	var getStaticView = function(viewUrl, success, failure, viewGenerationOptions) {		
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

	var getStaticMemberByUsername = function (username, success, failure) {
		var options = {};
		options.key = username;
		options.firstOnly = true;
		getStaticView("members/byUsername", success, failure, options);
	};

	var streamImageAttachment = function (username, attachmentName, headers, res, callback) {
		getStaticMemberByUsername(username, function (member) {
			var docId = member._id;

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

			// Stream the image to 'res'
			res.type("image/jpeg");
			readStream.pipe(res);
		}, callback);
	};

	var getImageByUsername = function (username, attachmentName, headers, res, callback) {
		var gotPatron = function (patron) {
			streamImageAttachment(patron, attachmentName, headers, res, callback);
		};

		var failure = function (err) {
			callback(err);
		};

		streamImageAttachment(username, attachmentName, headers, res, callback);
	};

	var getProfileImageByUsername = function (username, headers, res, callback) {
		getImageByUsername(username, "profile.jpg", headers, res, callback);
	};

	var saveImageByUsername = function (username, attachmentName, imageData, callback) {
		getStaticMemberByUsername(username, function (member) {
			if (member.length < 1) {
				var defaultDoc = {
					'username': username
				}
				database.insert(defaultDoc, function (err) {
					if (err) {
						callback(err);
					}
					else {
						saveImageByUsername(username, attachmentName, imageData, callback);
					}
				});
			}
			else {
				var docId = member._id;
				var contentType = "image/jpeg";
				var options = {};

				database.get(docId, function (err, body) {
					if (err) {
						callback(err);
					}
					else {
						options.rev = body._rev;
						database.attachment.insert(docId, attachmentName, imageData, 
							contentType, options, function (err) {
							if (err) {
								callback(err);
							}
							else {
								callback();
							}
						});
					}
				});
			}
		}, 
		callback);
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

	var _changeMemberUsername = function (oldName, newName, callback) {
		if (oldName === newName) {
			// Do nothing.
			callback();
			return;
		}

		var success = function (member) {
			member.username = newName;
			database.insert(member, function (err, body) {
				if (err) {
					console.log(err);
					callback(err);
				}
				else {
					callback();
				}
			});
		};

		getStaticMemberByUsername(oldName, success, callback);
	};

	var doInit = function (callback) {
		var staticConfig = {
			databaseUrl: couchHost + ':' + couchPort,
			databaseName: databaseName,
			username: dbConfig.username,
			password: dbConfig.password
		};

		nanoo.init(staticConfig);
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
		init: doInit,
		onlyForTest: {
			destroy: nanoo.destroyDatabase
		},
		changeMemberUsername: _changeMemberUsername,
		getMember: getStaticMemberByUsername,
		profileImages: {
			get: getProfileImageByUsername,
			save: saveProfileImageByUsername,
			getBackground: getBackgroundImageByUsername,
			saveBackground: saveBackgroundImageByUsername,
			getFuture: getFutureImageByUsername,
			saveFuture: saveFutureImageByUsername
		},
		communityImages: {
			get: getCommunityImageByUsername,
			save: saveCommunityImageByUsername,
			getIcon: getCommunityIconByUsername,
			saveIcon: saveCommunityIconByUsername
		}
	};
};

exports.db = db;