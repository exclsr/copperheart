// nanoo.js
//
// Something a little bigger than nano.
//
var nanoo = function () {
	var self = this;
	var nano = require('nano');

	var nanoMaster, database, isUsingAuth, cookieToken;
	var _config = {
		databaseUrl: undefined,
		databaseName: undefined,
		username: undefined,
		password: undefined
	};

	// TODO: Most npm modules are cooler than this.
	// Look into that.
	var init = function (config) {
		if (config) {
			for (var key in config) {
				_config[key] = config[key];
			}
		}

		isUsingAuth = _config.username && _config.password;
		nanoMaster = nano(_config.databaseUrl);
		// TODO: Call initDatabase
	};

	var initDatabase = function (cookieToken) {
		var options = {};
		options.url = _config.databaseUrl;

		if (isUsingAuth) {
			options.cookie = cookieToken || "";
		}
		database = nano(options).use(_config.databaseName);
	};

	var setCookieTokenFromHeaders = function (headers) {
		if (headers && headers['set-cookie']) {
			cookieToken = headers['set-cookie'];
			initDatabase(cookieToken);
		}		
	};

	var getCookieAuthHeaders = function () {
		var headers = {};
		if (isUsingAuth) {
			headers["X-CouchDB-WWW-Authenticate"] = "Cookie";
			headers["cookie"] = (cookieToken || "").toString();			
		}

		return headers;
	};

	var establishAuthorization = function (callback) {
		nanoMaster.auth(_config.username, _config.password, 
			function (err, body, headers) {
				if (err) {
					// TODO: Freak out.
					console.log("Failed to get cookie token");
					console.log(err);
					return;
				}
				setCookieTokenFromHeaders(headers);
				if (callback) {
					callback();
				}
			}
		);
	};

	// Connect to the database, callback with the response.
	// Can be useful for debugging.
	var refreshDatabaseConnection = function (callback) {
		var headers = getCookieAuthHeaders();
		var opts = {
			db: _config.databaseName,
			path: '',
			headers: headers
		};

		nanoMaster.relax(opts, function (error, response, headers) {
			if (error && error['status-code'] === 401) {
				// Unauthorized. 
				// TODO: Review logs to see if we need this.
				console.log("Called reauth from relax.");
				establishAuthorization();
			}
			else {
				setCookieTokenFromHeaders(headers);
			}

			if (callback) {
				callback(error, response, headers);
			}
		});
	};

	var establishDatabaseConnection = function (callback) {
		var keepDatabaseServerActive = function() {
			// So, our database host likes to go to sleep if it feels
			// there is nothing important to do, resulting in 50-second
			// response times, or in some cases timing out after a minute,
			// and giving us 500 errors.
			var fiveMinutes = 5 * 60 * 1000;
			setInterval(refreshDatabaseConnection, fiveMinutes);

			// Reauthorize with the server every twelve hours.
			// TODO: This is obviously a bad design. Get a handle
			// on what is actually happening.
			var twelveHours = 12 * 60 * 60 * 1000;
			setInterval(establishAuthorization, twelveHours);
		};

		var ready = function() {
			keepDatabaseServerActive();
			if (callback) {
				// TODO: This is not obvious to the casual observer,
				// but this is how nano is passed back to the 
				// nanoo user. Make it more obvious (probably by
				// changing how this is done).
				callback(database);
			}
		}

		if (isUsingAuth) {
			establishAuthorization(ready);
		}
		else {
			initDatabase();
			ready();
		}
	};

	var createDatabase = function (callback) {
		var headers = getCookieAuthHeaders();
			var opts = {
			db: _config.databaseName,
			method: "PUT",
			headers: headers
		};

		nanoMaster.relax(opts, callback);
	};

	var databaseExists = function (callback) {
		var headers = getCookieAuthHeaders();
		var opts = {
			db: _config.databaseName,
			method: "GET",
			headers: headers
		};

		nanoMaster.relax(opts, function (err, body) {
			if (err && err['status-code'] === 404) {
				callback(null, false);
			}
			else if (err) {
				callback(err);
			}
			else {
				callback(null, true);
			}
		});
	};

	var ensureExists = function (callback) {
		databaseExists(function (err, exists) {
			if (err) {
				callback(err);
			}
			else if (!exists) {
				createDatabase(function (err) {
					callback(err);
				});
			}
			else {
				callback();
			}
		});
	};

	var destroyDatabase = function (callback) {
		var headers = getCookieAuthHeaders();
		var opts = {
			db: _config.databaseName,
			method: "DELETE",
			headers: headers
		};

		nanoMaster.relax(opts, callback);
	};

	var getAttachmentStream = function (docId, attachmentName, headers, callback) {

		var _headers = getCookieAuthHeaders();
		// TODO: This works for Chrome. Are there other browser behaviors
		// that we need to care about?
		_headers["if-none-match"] = headers["if-none-match"];

		var attName = encodeURIComponent(attachmentName);
		var opts = {
			db: _config.databaseName,
			headers: _headers,
			method: "GET",
			doc: docId,
			params: {},
			att: attName,
			encoding: null
		};

		var readStream = nanoMaster.relax(opts, function (err) {
			if (err) {
				callback(err);
				return;
			}
		});

		callback(null, readStream);
	};

	self.init = init;
	self.connect = establishDatabaseConnection;
	self.refreshConnection = refreshDatabaseConnection;

	self.ensureExists = ensureExists;
	self.destroyDatabase = destroyDatabase;

	self.processHeaders = setCookieTokenFromHeaders;
	self.getAttachmentStream = getAttachmentStream;
};

module.exports = function () {
	return new nanoo();
};
