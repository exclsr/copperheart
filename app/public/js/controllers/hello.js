'use strict';

function HelloCtrl(session, $scope, $http, $location, $routeParams) {

	var profile = {};
	var patron = {};

	// TODO: Rename to something related to binding
	// to route params, as that's what we're really doing.
	var initialize = function (success) {

		var hadSuccess = false;
		var defaultProfileName = "phil"; // TODO: Will be going away, soon.
		profile.username = $routeParams.who || defaultProfileName;

		var isInitialized = function () {
			return profile
				&& profile.name
				&& profile.username
				&& profile.present
				&& profile.passions
				&& profile.communities
				&& profile.things
				&& patron.contributions;
		};

		var maybeSuccess = function() {
			if (!hadSuccess && isInitialized()) {
				hadSuccess = true;
				success();
			}
		};

		var onWhoReady = function (who) {
			profile.name = who.name;
			profile.present = who.present;
			profile.passions = who.passions;
			profile.communities = who.communities;
			maybeSuccess();
		};

		var onThingsReady = function (things) {
			profile.things = things;
			maybeSuccess();
		}

		var onContributionsReady = function (contributions) {
			patron.contributions = contributions;
			maybeSuccess();
		};

		$http.get('/who/' + profile.username)
		.success(onWhoReady)
		.error(function (data, status, headers, config) {
			// TODO: :-(
			console.log(data);
		});

		$http.get('/things/' + profile.username)
		.success(onThingsReady)
		.error(function (data, status, headers, config) {
			// TODO: Something terrible went wrong. Deal with it.
			console.log(data);
		});

		$http.get('/contributions/' + profile.username)
		.success(onContributionsReady)
		.error(function (data, status, headers, config) {
			// TODO: Once again, need an error handling scheme.
			console.log(data);
		});
	};


	var loadSession = function (success) {

		var hadSuccess = false;

		var isSessionLoaded = function() {
			return session.patron
				&& session.contributions
				&& session.contributions[profile.username];
		};

		var maybeSuccess = function() {
			if (!hadSuccess && isSessionLoaded()) {
				hadSuccess = true;
				success();
			}
		};

		var mergeThingsAndContributions = function (things, contributions) {

			if (things && contributions) {
				// TODO: Make this look better. This is O(n^2), but
				// that's probably ok in this situation, as n is probably
				// less than 100.
				var mergedContributions = [];
				angular.forEach(things, function (thing) {
					var isContributionFound = false;

					angular.forEach(contributions, function (contribution) {
						if (contribution.id === thing.id) {
							isContributionFound = true;
							mergedContributions.push(contribution);
						}
					});

					if (!isContributionFound) {
						mergedContributions.push(thing);
					}
					
				});

				session.contributions[profile.username] = mergedContributions;
				maybeSuccess();
			}
		};

		if (!session.patron.username) {
			$http.get('/whoami')
			.success(function (patron) {
					session.patron = patron;
					maybeSuccess();
			})
			.error(function(data, status, headers, config) {
				// TODO: Something terrible went wrong. Deal with it.
				console.log(data);
			});
		}

		if (!session.contributions[profile.username]) {
			mergeThingsAndContributions(profile.things, patron.contributions);
		}

		session.activeContribution.profile = profile;
		maybeSuccess();
	};


	var bindToSession = function() {
		$scope.contributions = session.contributions[profile.username];
		// When our local 'contributions' changes, update our session.
		$scope.$watch('contributions', function() {
			session.contributions[profile.username] = $scope.contributions;
		});
	};

	initialize(function() {
		loadSession(bindToSession);
	});

	//-----------------------------------------------------------
	// $scope things
	//
	$scope.profile = {};
	$scope.patron = {};

	// TODO: This is one way to do things, with
	// only using very simple getters for our
	// $scope properties. 
	//
	// How do we feel about that?
	$scope.patron.getUsername = function () {
		if (session && session.patron && session.patron.username) {
			return session.patron.username;
		}
		return "anonymous";
	};

	$scope.profile.getName = function() {
	 	return profile.name;
	};
	$scope.profile.getPresent = function() {
		return profile.present;
	}
	$scope.profile.getCommunities = function() {
		return profile.communities;
	};
	$scope.profile.getPassions = function() {
		return profile.passions;
	};


	var perMonthMultiplier = function (frequency) {
		switch (frequency) {
			case 'day': 
				return 365.0 / 12.0;

			case 'week': 
				// There are 4 and 1/3 weeks 
				// each month, on average.
				return 52.0 / 12.0;

			case 'month':
			default:
				return 1.0;
		}
	};

	$scope.priceNow = function() {
		var totalPrice = 0;

		// Angular figures out the data bindind dependencies
		// here and calls 'priceNow' whenever necessary.
		angular.forEach($scope.contributions, function (thing) {
			if (thing.canHaz && !thing.recurring) {
				totalPrice += thing.price;
			}
		});

		return totalPrice;
	};

	$scope.pricePerMonth = function() {
		var pricePerMonth = 0;

		angular.forEach($scope.contributions, function (thing) {
			var itemPrice = 0;

			if (thing.canHaz && thing.recurring) {
				itemPrice = thing.price * perMonthMultiplier(thing.frequency);
				pricePerMonth += itemPrice;
			}
		});

		return pricePerMonth;
	};

	$scope.toContribute = function() {
		// TODO: Can we $watch on the functions?
		session.activeContribution.priceNow = $scope.priceNow();
		session.activeContribution.pricePerMonth = $scope.pricePerMonth();
		session.save();

		$location.path('contribute');
	};
}
HelloCtrl.$inject = ['session', '$scope', '$http', '$location', '$routeParams'];
