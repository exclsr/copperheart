'use strict';

function HelloCtrl($scope, $http, $location, $routeParams, session, activeContribution) {

	// TODO: We'll prob want to call things when traversing from
	// another page, such as going back from the 'contribute' page.
	// But that will be a problem for future self ...
	var initialize = function () {

		var everythingAtOnce = function (things, contributions) {
			if (things && contributions) {

				// TODO: Make this look better. This is O(n^2), but
				// that's probably ok in this situation, as n is probably
				// less than 100.
				var mergedThings = [];
				angular.forEach(things, function (thing) {
					var isContributionFound = false;

					angular.forEach(contributions, function (contribution) {
						if (contribution.id === thing.id) {
							isContributionFound = true;
							mergedThings.push(contribution);
						}
					});

					if (!isContributionFound) {
						mergedThings.push(thing);
					}
					
				});

				$scope.things = session.things = mergedThings;
				// When our local 'things' changes, update our session.
				$scope.$watch('things', function() {
					session.things = $scope.things;
				});
			}
		};

		var profileName = $scope.profileName = $routeParams.who || "phil";
		var blahThings, blahContributions; // TODO: Rename.

		// TODO: Obviously, will want to make this URL adaptive to 
		// whatever profile we're looking at.
		var thingsRes = $http.get('/things/' + profileName + '/');

		thingsRes.success(function (things) {
			blahThings = things;
			everythingAtOnce(blahThings, blahContributions);
		});

		thingsRes.error(function (data, status, headers, config) {
			// TODO: Something terrible went wrong. Deal with it.
			console.log(data);
		});


		var contributionsRes = $http.get('/contributions/' + profileName + '/');
		contributionsRes.success(function (contributions) {
			blahContributions = contributions;
			everythingAtOnce(blahThings, blahContributions);
		});

		contributionsRes.error(function (data, status, headers, config) {
			// TODO: Once again, need an error handling scheme.
			console.log(data);
		})

		var whoRes = $http.get('/who/' + profileName + '/');
		whoRes.success(function (who) {
			$scope.who = {};
			$scope.who.name = who.name;
			$scope.who.present = who.present;
			$scope.who.passions = who.passions;
			$scope.who.communities = who.communities;
		});
		whoRes.error(function (data, status, headers, config) {
			// TODO: :-(
			console.log(data);
		});


		var idRes = $http.get('/whoami');
		idRes.success(function (patronId) {
			$scope.whoami = session.whoami = patronId;
		});

		idRes.error(function(data, status, headers, config) {
			// TODO: Something terrible went wrong. Deal with it.
			console.log(data);
		});
	};

	// TODO: Re-init when appropriate ... gets more complicated
	// now that the 'who' can changed based on the url, maybe. 
	if (!session.things || session.things.length < 1 || !$scope.who) {
		initialize();
	}
	else {
		$scope.things = session.things;
		$scope.whoami = session.whoami;
	}

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
		angular.forEach($scope.things, function (thing) {
			if (thing.canHaz && !thing.recurring) {
				totalPrice += thing.price;
			}
		});

		return totalPrice;
	};

	$scope.pricePerMonth = function() {
		var pricePerMonth = 0;

		angular.forEach($scope.things, function (thing) {
			var itemPrice = 0;

			if (thing.canHaz && thing.recurring) {
				itemPrice = thing.price * perMonthMultiplier(thing.frequency);
				pricePerMonth += itemPrice;
			}
		});

		return pricePerMonth;
	};

	$scope.toContribute = function() {

		// TODO: Maybe make a contribution object, for fun.
		activeContribution.things = [];

		// TODO: Maybe use data binding to get this in real-time.
		angular.forEach($scope.things, function (thing) {
			if (thing.canHaz) {
				activeContribution.things.push(thing);
			}
		});

		activeContribution.priceNow = $scope.priceNow();
		activeContribution.pricePerMonth = $scope.pricePerMonth();

		$location.path('contribute/' + $scope.profileName);
	};
}
HelloCtrl.$inject = ['$scope', '$http', '$location', '$routeParams', 'session', 'activeContribution'];
