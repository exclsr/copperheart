'use strict';

/* Services */

angular.module('myApp.services', []).
	value('version', '0.4').
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
				patron: {},
				activeContribution: {
					profile: {},
					priceNow: 0,
					pricePerMonth: 0
				},
				contributions: {},
				expirationDate: getExpirationDate(today)
			}
		}(); // closure

		// TODO: Need a way to expire session state.
		var session = store.get(sessionKey);
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

