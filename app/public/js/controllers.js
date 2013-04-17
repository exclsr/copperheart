'use strict';

/* Controllers */
function EditCtrl($scope, $http, session) {

	var initialize = function () {

		var whoRes = $http.get('/whoami');
		whoRes.success(function (patronId) {
			$scope.whoami = session.whoami = patronId;
		});

		whoRes.error(function(data, status, headers, config) {
			// TODO: Something terrible went wrong. Deal with it.
			console.log(data);
		});

		var patronRes = $http.get('/patron');
		patronRes.success(function (patron) {
			$scope.patron = patron;
			$scope.email = patron.email;
			$scope.username = patron.username;
			$scope.things = patron.things;
			$scope.name = patron.name;
			$scope.present = patron.present;
			$scope.passions = patron.passions;
			$scope.communities = patron.communities;
		});

		patronRes.error(function(data, status, headers, config) {
			// TODO: Something terrible went wrong. Deal with it.
			console.log(data);
		});
	};

	$scope.saveWho = function() {
		var who = {};
		who.name = $scope.name;
		who.present = $scope.present;

		var putWho = $http.put('/patron/who', who);
		putWho.success(function (data) {
			console.log("<3");
		});
		putWho.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};


	$scope.saveUsername = function() {
		var data = {};
		data.username = $scope.username;

		var putUsername = $http.put('/patron/username', data);
		putUsername.success(function (data) {
			console.log("<3");
		});
		putUsername.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};


	$scope.isAtCommunityLimit = function() {
		var communities = $scope.communities || [];
		return communities.length >= 5;
	};

	var saveCommunities = function (communities, callback) {
		var putCommunities = $http.put('/patron/communities', communities);
		putCommunities.success(function (data) {
			$scope.communities = communities;
			console.log("<3");
			callback();
		});
		putCommunities.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	$scope.saveCommunity = function() {
		var communities = [];
		// Prepare passions for the server, while keeping our
		// UI the same. TODO: What do we want to do -- wait
		// to hear from the server before updating the UI,
		// or to be "responsive." Let's start with being
		// honest about what is happening, then go from there.
		angular.forEach($scope.communities, function (community) {
			communities.push(community);
		});
		communities.push($scope.newCommunity);

		saveCommunities(communities, function() {
			$scope.newCommunity = {};
			$scope.newCommunity.url = "";
			$scope.newCommunity.name = "";
		});
	};

	$scope.deleteCommunity = function(communityToDelete) {
		var communitiesToKeep = [];
		// TODO: Rumor is that animations are coming in the next
		// release of AngularJS for this sort of thing, so hold
		// tight for now.
		angular.forEach($scope.communities, function (community) {
			if (community !== communityToDelete) {
				communitiesToKeep.push(community);
			}
		});

		saveCommunities(communitiesToKeep);
	};


	$scope.isAtPassionLimit = function() {
		var passions = $scope.passions || [];
		return passions.length >= 3;
	};

	var savePassions = function (passions, callback) {
		var putPassions = $http.put('/patron/passions', passions);
		putPassions.success(function (data) {
			$scope.passions = passions;
			console.log("<3");
			callback();
		});
		putPassions.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	$scope.savePassion = function() {
		var passions = [];
		// Prepare passions for the server, while keeping our
		// UI the same. TODO: What do we want to do -- wait
		// to hear from the server before updating the UI,
		// or to be "responsive." Let's start with being
		// honest about what is happening, then go from there.
		angular.forEach($scope.passions, function (passion) {
			passions.push(passion);
		});
		passions.push($scope.newPassion);

		savePassions(passions, function() {
			$scope.newPassion = "";
		});
	};

	$scope.deletePassion = function(passionToDelete) {
		var passionsToKeep = [];
		// TODO: Rumor is that animations are coming in the next
		// release of AngularJS for this sort of thing, so hold
		// tight for now.
		angular.forEach($scope.passions, function (passion) {
			if (passion !== passionToDelete) {
				passionsToKeep.push(passion);
			}
		});

		savePassions(passionsToKeep);
	};


	var saveThings = function (things) {
		var putThings = $http.put('/patron/things', things);

		putThings.success(function (data) {
			console.log(data);
			// TODO: Where should this be? Here?
			$scope.things = things;
		});

		putThings.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	var createThingId = function (thingName, things) {
		// TODO: I guess we could do this on the server 
		// side, but why not distribute the computing, eh?
		var newThingId = thingName;
		var canUseThingId = false;
		var loopCount = 1;

		while (!canUseThingId) {
			var duplicateIdFound = false;

			angular.forEach(things, function (thing) {
				// If our proposed newThingId is already
				// being used, try again.
				if (thing.id === newThingId) {
					duplicateIdFound = true;
					loopCount++;
					newThingId = thingName + loopCount.toString();
					return;
				}
			});

			if (!duplicateIdFound) {
				canUseThingId = true;
			}
		}

		return newThingId;
	};


	$scope.addThing = function() {
		var things = $scope.things;
		var newThing = {};
		newThing.id = createThingId($scope.thing.name, things);
		newThing.name = $scope.thing.name;
		newThing.unit = $scope.thing.unit;
		newThing.price = $scope.thing.price;
		newThing.frequency = "month"; // TODO: Don't need this?

		things.push(newThing);
		saveThings(things);
	};


	$scope.deleteThing = function(thingToDelete) {
		var thingsToKeep = [];
		// TODO: Rumor is that animations are coming in the next
		// release of AngularJS for this sort of thing, so hold
		// tight for now.
		angular.forEach($scope.things, function(thing) {
			if (thing.id !== thingToDelete.id) {
				thingsToKeep.push(thing);
			}
		});

		saveThings(thingsToKeep);
	};

	initialize();
}
EditCtrl.$inject = ['$scope', '$http', 'session'];



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




function ContributeCtrl($scope, $http, $routeParams, session, activeContribution) {

	$scope.whoami = session.whoami;
	$scope.things = activeContribution.things;
	$scope.priceNow = activeContribution.priceNow;
	$scope.pricePerMonth = activeContribution.pricePerMonth;

	var initialize = function () {

		var contributingTo = $routeParams.who;
		
		// TODO: refactor dup code
		var whoRes = $http.get('/who/' + contributingTo);
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

		// For testing ...
		if (!activeContribution || !activeContribution.things.length > 0) {
			$scope.whoami = "anonymous";
			$scope.things = [
				{
					"id": "wine",
					"name": "wine",
					"unit": "glass",
					"price": 5,
					"frequency": "month",
					"canHaz": true,
					"recurring": true
				},
				{
					"id": "internet",
					"name": "Internet",
					"unit": "day",
					"price": 2,
					"frequency": "month",
					"canHaz": true
				}
			];
			$scope.priceNow = 7.00;
			$scope.pricePerMonth = 5.00;
		}
	};

	initialize();

	$scope.isLoggedIn = function() {
		if (session && session.whoami && session.whoami !== "anonymous") {
			return true;
		}

		return false;
	};

	$scope.isLoginNeeded = function () {
		// The patron needs to log in if there
		// is a recurring payment.
		var isLoginNeeded = false;
		if ($scope.isLoggedIn()) {
			return false;
		}

		angular.forEach($scope.things, function (thing) {
			if (thing.recurring && thing.canHaz) {
				isLoginNeeded = true;
				return;
			}
		});

		return isLoginNeeded;
	};


	$scope.cc = {};
	$scope.cc.expMonth = '01';

	$scope.months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
	$scope.years = [];

	// TODO: Inject date, so we can test.
	var today = new Date();
	var currentYear = today.getFullYear(); 
	$scope.cc.expYear = currentYear;
	for (var i=0; i < 25; i++) {
		$scope.years.push(currentYear);
		currentYear++;
	}

	$scope.paymentDay = Math.min(today.getDate(), 28);
	$scope.daysOfTheMonth = [];
	for (var i=1; i < 29; i++) {
		$scope.daysOfTheMonth.push(i);
	}
	// TODO: See if we can do this with our payment processor.
	$scope.daysOfTheMonth.push('last');

	var currentMonth = today.getMonth();
	var nextMonth = currentMonth + 1;
	if (nextMonth === 12) {
		nextMonth = 1;
	}
	$scope.nextMonth = nextMonth;

	$scope.submitPayment = function() {
		
		$scope.result = "...";

		var creditCard = {
			number: $scope.cc.number,
			cvc: $scope.cc.cvc,
			exp_month: $scope.cc.expMonth,
			exp_year: $scope.cc.expYear
		};

		var makeCharges = function (patronId, things, stripeToken) {

			// TODO: Revisit the names of these.
			var data = { 
				stripeToken: stripeToken,
				things: things,
				patronId: patronId
			};
				
			var res = $http.put('/commit/phil/', data);
			res.success(function(data) {
				console.log(data);
				// The server is happy.
				$scope.result = ":-)";
			});

			res.error(function(data, status, headers, config) {
				console.log(data);
				// The server is sad.
				$scope.result = ":-("
			});
		};

		var stripeResponseHandler = function(status, response) {
			if (response.error) {
				// Show the errors on the form
				$scope.errorMessage = response.error.message;
			} 
			else {
				makeCharges($scope.whoami, $scope.things, response.id);
			}
		};

		// TODO: Learn how to inject something like Stripe, then do so.
		Stripe.createToken(creditCard, stripeResponseHandler);
	};
}
ContributeCtrl.$inject = ['$scope', '$http', '$routeParams', 'session', 'activeContribution'];


