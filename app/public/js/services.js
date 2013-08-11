'use strict';

/* Services */

// Added to make dates format to ISO8601 across browsers
// h/t: http://stackoverflow.com/a/2218874/124487
Date.prototype.toJSON = function (key) {
    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    return this.getUTCFullYear()   + '-' +
         f(this.getUTCMonth() + 1) + '-' +
         f(this.getUTCDate())      + 'T' +
         f(this.getUTCHours())     + ':' +
         f(this.getUTCMinutes())   + ':' +
         f(this.getUTCSeconds())   + '.' +
         f(this.getUTCMilliseconds())   + 'Z';
};

angular.module('myApp.services', []).
	value('version', '0.9').
	factory('httpOptions', function($cacheFactory) {
		var cacheSize = 100;
		var cache = $cacheFactory("copperheart", cacheSize);
		var httpOptions = {
			cache: cache
		};
		return httpOptions;
	}).
	factory('session', function() {
		// session: use localStorage to maintain session
		// state across visits to the page and refreshes.

		// TODO: 'today' should be injected
		var today = new Date();
		var sessionKey = 'session';

		var getExpirationDate = function (today) {
			// expire in 12 hours. 
			// 
			// The purpose of the session is to let us 
			// bounce around the site, and refresh the 
			// page, without worrying too much. 
			// 
			// In other words, most of the data we're
			// keeping track of in the session will 
			// be irrelevant in 12 hours, anyway.
			// 
			var expirationDate = new Date();
			expirationDate.setHours(today.getHours() + 12);
			return expirationDate;
		};

		var defaultSession = function() {
			return {
				patron: {
					role: 'guest'
				},
				activeContribution: {
					profile: {},
					priceNow: 0,
					pricePerMonth: 0
				},
				contributions: {},
				expirationDate: getExpirationDate(today)
			}
		}(); // closure

		var getSession = function() {
			var session = store.get(sessionKey);
			
			if (!session) {
				return session;
			}
			// Dates are stored as strings in JSON. That's cool,
			// but we want to have actual Date objects.
			if (session.expirationDate) {
				session.expirationDate = new Date(session.expirationDate);
			}

			return session;
		};

		var session = getSession();
		if (!session 
		 || !session.expirationDate
		 || session.expirationDate < today) {
			// Load the default session if we don't have
			// one in the local store, or if the one
			// in the local store is stale.
			session = defaultSession;
		}
		else {
			// There is a non-stale session in local storage,
			// so let's refresh the expiration date.
			// TODO: Is this dumb? Should there be a 
			// set time where we always clear out the
			// session data?
			session.expirationDate = getExpirationDate(today);
		}

		// Add our functions back, since JSON.stringify stripped them out.
		if (!session.save) {
			session.save = function() {
				var now = new Date();
				session.expirationDate = getExpirationDate(now);
				store.set(sessionKey, session);
			};
		}

		return session;
	});

