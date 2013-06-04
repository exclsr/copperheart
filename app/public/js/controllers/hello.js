'use strict';

function HelloCtrl(session, $scope, $http, $location, $routeParams) {

	var profile = {};
	var patron = {};
	var member = {};
	session.pageName = "hello";

	var redirectToEntrance = function (reason) {
		// called in failure situations.
		console.log(reason);
		$location.path('/entrance');
	};

	// TODO: Rename to something related to binding
	// to route params, as that's what we're really doing.
	var initialize = function (success, failure) {

		var hadSuccess = false;
		
		if (!$routeParams.who) {
			failure("Someone didn't tell us the username of the profile to show.");
			return;
		}
		
		profile.username = $routeParams.who;

		var isInitialized = function () {
			return profile
				&& profile.name
				&& profile.username
				&& profile.present
				&& profile.passions
				&& profile.communities
				&& profile.things
				&& member.support
				&& member.backers
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
			var defaultThings = things;
			// set the default for each thing to be
			// a monthly contribution.
			angular.forEach(defaultThings, function (thing) {
				thing.recurring = true;
				thing.frequency = "month";
			});
			profile.things = defaultThings;
			maybeSuccess();
		}

		var onContributionsReady = function (contributions) {
			patron.contributions = contributions;
			maybeSuccess();
		};

		var onSupportReady = function (support) {
			member.support = support;
			maybeSuccess();
		};

		var onBackersReady = function (backers) {
			member.backers = backers;
			maybeSuccess();
		}

		$http.get('/who/' + profile.username)
		.success(onWhoReady)
		.error(function (data, status, headers, config) {
			// TODO: :-(
			console.log(data);
		});

		// TODO: Make a config object for DI to set n=4
		$http.get('/things/' + profile.username + '?n=4')
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

		$http.get('/support/' + profile.username)
		.success(onSupportReady)
		.error(function (data, status, headers, config) {
			console.log(data);
		});

		$http.get('/support/' + profile.username + '/names')
		.success(onBackersReady)
		.error(function (data, status, headers, config) {
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


		if (!session.contributions[profile.username]) {
		 	mergeThingsAndContributions(
		 		profile.things, 
		 		patron.contributions);
		}
		else {
			mergeThingsAndContributions(
				profile.things, 
				session.contributions[profile.username]);
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

	initialize(
		function() {
			loadSession(bindToSession);
		}, 
		redirectToEntrance
	);

	//-----------------------------------------------------------
	// $scope things
	//
	$scope.profile = {};

	// TODO: This is one way to do things, with
	// only using very simple getters for our
	// $scope properties. 
	//
	// How do we feel about that?
	//
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
	$scope.profile.getSupport = function() {
		return member.support;
	};
	$scope.profile.getBackers = function() {
		return member.backers;
	};

	$scope.canHazContribution = function () {
		var canHaz = false;

		angular.forEach($scope.contributions, function (thing) {
			if (thing.canHaz) {
				canHaz = true;
			}
		});

		return canHaz;
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
				totalPrice += parseFloat(thing.price);
			}
		});

		return totalPrice;
	};

	$scope.pricePerMonth = function() {
		var pricePerMonth = 0;

		angular.forEach($scope.contributions, function (thing) {
			var itemPrice = 0;

			if (thing.canHaz && thing.recurring) {
				itemPrice = parseFloat(thing.price) * perMonthMultiplier(thing.frequency);
				pricePerMonth += itemPrice;
			}
		});

		return pricePerMonth;
	};

	$scope.setFrequency = function (thing, freq) {

		angular.forEach($scope.contributions, function (contribution) {
			if (contribution.id === thing.id) {
				if (freq === 'once') {
					contribution.recurring = false;
				}
				else {
					contribution.recurring = true;
					contribution.frequency = freq;
				}
			}
		});
	};

	$scope.isEqual = function (a, b) {
		return a === b;
	};

	$scope.toContribute = function() {
		// TODO: Can we $watch on the functions?
		session.activeContribution.priceNow = $scope.priceNow();
		session.activeContribution.pricePerMonth = $scope.pricePerMonth();
		session.save();

		$location.path('/contribute');
	};
}
HelloCtrl.$inject = ['session', '$scope', '$http', '$location', '$routeParams'];
