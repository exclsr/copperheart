'use strict';

function HelloCtrl(session, $scope, $http, httpOptions, $location, $routeParams) {

	var profile = {};
	var community = undefined;
	var placeholderUrl = "/img/placeholder.png";

	var patron = {};
	var member = {};

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

		var onStaticBaseUrlReady = function (baseUrl) {
			profile.staticBaseUrl = baseUrl;
			profile.imageUrl = baseUrl + "profile.jpg";
			profile.backgroundUrl = baseUrl + "background.jpg";
			profile.futureUrl = baseUrl + "future.jpg";
		};

		var onWhoReady = function (who) {
			profile.name = who.name;
			profile.present = who.present;
			profile.background = who.background;
			profile.future = who.future;
			profile.passions = who.passions;
			profile.communities = who.communities;
			profile.photoCredits = who.photoCredits;

			// Set the active community if there is one.
			var communityIndex = $routeParams.communityId;
			if (communityIndex >= 0 && communityIndex < profile.communities.length) {
				community = profile.communities[communityIndex];
			}
			else {
				community = undefined;
			}

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
		};

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

		$http.get('/who/' + profile.username, httpOptions)
		.success(onWhoReady)
		.error(function (data, status, headers, config) {
			// TODO: :-(
			console.log(data);
		});

		$http.get('/profile/' + profile.username + '/static-base-url', httpOptions)
		.success(onStaticBaseUrlReady)
		.error(function (data, status, headers, config) {
			// TODO: :-(
			console.log(data);
		});

		// TODO: Make a config object for DI to set n=4
		$http.get('/things/' + profile.username + '?n=4', httpOptions)
		.success(onThingsReady)
		.error(function (data, status, headers, config) {
			// TODO: Something terrible went wrong. Deal with it.
			console.log(data);
		});

		$http.get('/contributions/' + profile.username, httpOptions)
		.success(onContributionsReady)
		.error(function (data, status, headers, config) {
			// TODO: Once again, need an error handling scheme.
			console.log(data);
		});

		$http.get('/support/' + profile.username, httpOptions)
		.success(onSupportReady)
		.error(function (data, status, headers, config) {
			console.log(data);
		});

		$http.get('/support/' + profile.username + '/names', httpOptions)
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


	var scrollTo = function (elementId) {
		// use jQuery for smooth scrolling.
		$('html, body').animate({
			scrollTop: $("#" + elementId).offset().top
		}, 500);
	};

	var bindToSession = function() {
		$scope.contributions = session.contributions[profile.username];
		// When our local 'contributions' changes, update our session.
		$scope.$watch('contributions', function() {
			session.contributions[profile.username] = $scope.contributions;
		});

		$scope.boundSession = session;
		$scope.$watch('boundSession.isContributing', function (newValue, oldValue) {
			// We don't care unless we're explicitly changing from false to true.
			if (oldValue === false && session.isContributing) {
				scrollTo('contributeStart');
			}
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
	$scope.profile.getName = function() {
		return profile.name;
	};
	$scope.profile.getPresent = function() {
		return profile.present;
	};
	$scope.profile.getBackground = function() {		
		return profile.background;
	};
	$scope.profile.getFuture = function() {
		return profile.future;
	};
	$scope.profile.getCommunities = function() {
		return profile.communities;
	};
	$scope.profile.getPhotoCredit = function(name) {
		if (profile && profile.photoCredits) {
			return profile.photoCredits[name];	
		}
	};
	$scope.profile.getPassions = function() {
		return profile.passions;
	};
	$scope.profile.getThingsWithGoals = function() {
		if (!profile || !profile.things) {
			return;
		}

		var withGoals = [];
		angular.forEach(profile.things, function (thing) {
			if (thing.goal && thing.goal > 0) {
				withGoals.push(thing);
			}
		});

		return withGoals;
	};

	$scope.profile.getSupport = function() {
		return member.support;
	};
	$scope.getSupportWithoutGoals = function () {
		if (!member || !member.support || !profile || !profile.things) {
			return;
		}

		var support = [];
		// The things in the support array don't have goals
		// necessarily. Those are stored in the profile array.
		//
		// TODO: This is O(n^2). Maybe work around that by
		// storing things via thing.id as a key.
		angular.forEach(member.support, function (thing) {
			angular.forEach(profile.things, function (profileThing) {
				if (profileThing.id === thing.id) {
					if (!profileThing.goal || profileThing.goal <= 0) {
						support.push(thing);
					}
				}
			});
		});

		return support;
	};
	$scope.canHazNiceThings = function () {
		var niceThings = $scope.getSupportWithoutGoals();
		return niceThings && niceThings.length > 0;		
	};

	// For hacking ng-repeat 
	$scope.getFakeArray = function (length) {
		var fakeArray = new Array(length);
		return fakeArray;
	};


	$scope.profile.getBackers = function() {
		return member.backers;
	};

	$scope.getPercentOfGoalForThing = function (thing) {
		if (!thing || !member || !member.support) {
			return 0;
		}

		var percent = 0;
		var supportThing = member.support[thing.id];
		if (!supportThing) {
			return percent;
		}

		if (thing.goal > 0) {
			percent = Math.floor(100 * (supportThing.count / thing.goal));
		}
		return percent;
	};

	$scope.getSupportStrength = function () {
		var thingsWithGoals = $scope.profile.getThingsWithGoals();
		if (!thingsWithGoals)
			return 0;

		var priceTotal = 0;
		var completeTotal = 0;

		angular.forEach(thingsWithGoals, function (thing) {
			var price = parseFloat(thing.price);
			priceTotal += price;
			completeTotal += $scope.getPercentOfGoalForThing(thing) * 0.01 * price;
		});

		var supportStrength = Math.ceil(100 * completeTotal / priceTotal);
		return supportStrength;
	};

	var getHelloUrl = function () {
		return '#/hello/' + profile.username;
	}
	$scope.profile.getHelloUrl = function() {
		return getHelloUrl();
	};
	$scope.profile.getBackgroundUrl = function() {
		return getHelloUrl() + '/background';
	};
	$scope.profile.getFutureUrl = function() {
		return getHelloUrl() + '/future';	
	};
	$scope.profile.getSupportUrl = function () {
		return getHelloUrl() + '/support';
	};
	$scope.profile.getImageUrl = function() {
		return profile ? profile.imageUrl : placeholderUrl;
	};
	$scope.profile.getBackgroundImageUrl = function() {
		return profile.backgroundUrl;
	};
	$scope.profile.getFutureImageUrl = function() {
		return profile.futureUrl;
	};

	$scope.isShowingHello = function () {
		var isNotShowingHello = $scope.isShowingCommunity() 
		|| $scope.showBackground() 
		|| $scope.showFuture() 
		|| $scope.showSupport();
		return !isNotShowingHello;
	};
	$scope.isShowingCommunity = function () {
		return ($routeParams.communityId !== undefined);
	};
	$scope.getCommunity = function () {
		return community;
	};

	// TODO: This URL stuff that depends on server data
	// should be on the server side.
	var getCommunityProfilePath = function (community) {
		var communityIndex = profile.communities.indexOf(community);
		var path = '/hello/' + profile.username;
		if (communityIndex >= 0) {
			path += '/community/' + communityIndex;
		}
		return path;
	}
	$scope.profile.getCommunityUrl = function (community) {
		return "#" + getCommunityProfilePath(community);
	};
	$scope.showCommunity = function (community) {
		$location.path(getCommunityProfilePath(community));
	};


	var getCommunityImagePath = function (community) {
		if (!community || !profile.staticBaseUrl) {
			return '';
		}
		var path = profile.staticBaseUrl + encodeURIComponent(community.name);
		return path;
	};
	$scope.getCommunityImageUrl = function (community) {
		if (!community || !profile.staticBaseUrl) {
			return placeholderUrl;
		}
		else {
			return getCommunityImagePath(community) + ".jpg";
		}
	};
	$scope.getCommunityIconUrl = function (community) {
		if (!community || !profile.staticBaseUrl) {
			return placeholderUrl;
		}
		else {
			return getCommunityImagePath(community) + 'icon.jpg';	
		}
	};

	var locationHasToken = function (token) {
		return $location.path().split('/').indexOf(token) >= 0;
	};
	$scope.showFuture = function () {
		return locationHasToken("future");
	};
	$scope.showBackground = function () {
		return locationHasToken("background");
	};
	$scope.showSupport = function () {
		return locationHasToken("support");
	};

	$scope.isContributing = function () {
		// TODO: Also return true if the patron has some contributions
		// from a previous session.
		return session.isContributing;
	};
	$scope.startContributing = function () {
		if (session.isContributing) {
			// Hack, because the watch method isn't effective
			// in this situation (I think).
			scrollTo('contributeStart');
		}
		session.isContributing = true;
	};
	$scope.stopContributing = function () {
		session.isContributing = false;
		session.save();
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

	$scope.toContribute = function() {
		// TODO: Can we $watch on the functions?
		session.activeContribution.priceNow = $scope.priceNow();
		session.activeContribution.pricePerMonth = $scope.pricePerMonth();
		session.save();

		$location.path('/contribute');
	};

}
HelloCtrl.$inject = ['session', '$scope', '$http', 'httpOptions', '$location', '$routeParams'];
