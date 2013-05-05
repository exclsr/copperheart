'use strict';

function ContributeCtrl(session, $scope, $http, $routeParams) {

	session.pageName = "contribute";
	var contributionTo = undefined;
	var patron = undefined;

	var bindToSession = function() {

		contributionTo = session.activeContribution.profile.username;
		var contributions = session.contributions[contributionTo];

		$scope.things = [];
		angular.forEach(contributions, function (thing) {
			if (thing.canHaz) {
				$scope.things.push(thing);
			}
		});

		$scope.priceNow = session.activeContribution.priceNow;
		$scope.pricePerMonth = session.activeContribution.pricePerMonth;
		$scope.who = session.activeContribution.profile;

		patron = session.patron;
	};

	var initialize = function() {
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
		var paymentYear = today.getFullYear();
		var nextMonth = currentMonth + 1;
		if (nextMonth === 11) {
			nextMonth = 0;
			paymentYear++;
		}
		$scope.paymentMonth = nextMonth;
		$scope.paymentYear = paymentYear;
	};

	bindToSession();
	initialize();

	//---------------------------------------------------------
	// $scope methods
	//---------------------------------------------------------

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

	$scope.isErrorHappening = function() {
		if ($scope.errors) {
			return ($scope.errors.isCard ||
				$scope.errors.isApi ||
				$scope.errors.isProgrammer);
		}

		return false;
	}

	$scope.makeContribution = function() {
		
		$scope.status = "...";
		$scope.errors = {}; // clear error flags

		var things = $scope.things;
		
		var canHazRecurring = function() {
			var canHaz = false;

			if (!$scope.isLoggedIn()) {
				return false;
			}

			angular.forEach(things, function (thing) {
				if (thing.canHaz) {
					if (thing.recurring) {
						canHaz = true;
					}
				}
			});

			return canHaz;
		}(); // closure

		var canHazOneTime = function() {
			var canHaz = false;

			angular.forEach(things, function (thing) {
				if (thing.canHaz) {
					if (!thing.recurring) {
						canHaz = true;
					}
				}
			});

			return canHaz;
		}(); // closure

		var numberOfTokensRequired = function() {
			var tokensRequired = 0;

			if (canHazRecurring) {
				tokensRequired++;
			}
			if (canHazOneTime) {
				tokensRequired++;
			}

			return tokensRequired;
		}(); // closure

		var creditCard = {
			name: $scope.cc.name,
			number: $scope.cc.number,
			cvc: $scope.cc.cvc,
			exp_month: $scope.cc.expMonth,
			exp_year: $scope.cc.expYear
		};

		var refreshView = function() {
			// TODO: Why do we need this?
			$scope.$digest();
		};

		// Credit: http://stackoverflow.com/a/11252167/124487
		// TODO: Probably move to the server
		var treatAsUTC = function (date) {
			var result = new Date(date);
			result.setMinutes(result.getMinutes() - result.getTimezoneOffset());
			return result;
		};

		var daysBetween = function (startDate, endDate) {
			var millisecondsPerDay = 24 * 60 * 60 * 1000;
			return (treatAsUTC(endDate) - treatAsUTC(startDate)) / millisecondsPerDay;
		};

		var makeRecurringCharges = function (things, stripeToken) {
			if (!$scope.isLoggedIn()) {
				console.log("Programmer error: " + 
					"Cannot make recurring charges if not logged in.");
				return;
			}

			var now = new Date();
			var paymentDate = new Date(
				$scope.paymentYear, $scope.paymentMonth, $scope.paymentDay);
			var daysUntilPayment = Math.ceil(daysBetween(now, paymentDate)); 

			var patronEmail = session.patron.email;

			// TODO: Revisit the names of these.
			var data = { 
				stripeToken: stripeToken,
				things: things,
				patronEmail: patronEmail,
				daysUntilPayment: daysUntilPayment
			};
				
			var res = $http.put('/commit/' + contributionTo, data);
			res.success(function(data) {
				// TODO: Now what?
				console.log(data);
				// The server is happy.
				$scope.status += " :-)";
			});

			res.error(function(data, status, headers, config) {
				console.log(data);
				// The server is sad.
				$scope.status += " :-(";
			});
		};

		var makeOneTimeCharges = function (things, stripeToken) {
			var data = { 
				stripeToken: stripeToken,
				things: things
			};

			var res = $http.put('/commit/once/' + contributionTo, data);
			res.success(function(data) {
				console.log(data);
				// The server is happy.
				$scope.status += " :-)";
			// TODO: Now what?
			});

			res.error(function(data, status, headers, config) {
				console.log(data);
				// The server is sad.
				$scope.status += ":-(";
			});
		};

		var handleTokenCreated = function (response1, response2) {
			$scope.status = ":-)";

			var recurringThings = [];
			var oneTimeThings = [];
			
			angular.forEach(things, function (thing) {
				if (thing.canHaz) {
					if (thing.recurring) {
						recurringThings.push(thing);
					}
					else {
						oneTimeThings.push(thing);
					}
				}
			});

			if (canHazRecurring && canHazOneTime && response2) {
				// Can haz all the things
				makeRecurringCharges(recurringThings, response1.id);
				makeOneTimeCharges(oneTimeThings, response2.id);
			}
			else if (canHazRecurring) {
				makeRecurringCharges(recurringThings, response1.id);
			}
			else if (canHazOneTime) {
				makeOneTimeCharges(oneTimeThings, response1.id);
			}

			refreshView();
		};

		var handleCardError = function (response) {
			$scope.errors.isCard = true;
			refreshView();
		};

		var handleProgrammerError = function (status, response) {
			$scope.errors.isProgrammer = true;
			console.log(status);
			console.log(response);
			refreshView();
		};

		var handleStripeApiError = function (response) {
			$scope.errors.isApi = true;
			refreshView();
		} 

		var handleUnknownResponse = function (status, response) {
			// TODO: Update the UI, maybe?
			handleProgrammerError(status, response);
		};

		var handleCreateTokenError = function (status, response) {
			switch (status) {
				case 402: // request failed 
					handleCardError(response);
					break;

				case 400: case 401: 
					// bad request | unauthorized
					handleProgrammerError(status, response);
					break;

				case 500: case 502: case 503: case 504: 
					// stripe errors
					handleStripeApiError(response);
					break;

				default:
					handleUnknownResponse(status, response);
					break;
			}
		};

		var stripeResponseHandler = function(status1, response1) {
			if (status1 === 200) {
				// 200 ok!
				if (numberOfTokensRequired === 1) {
					handleTokenCreated(response1);
				}
				else if (numberOfTokensRequired === 2) {
					// Ok, we have one token. Cool. But we need two,
					// one for one-time charges and one for recurring charges.
					Stripe.createToken(creditCard, function (status2, response2) {
						if (status2 === 200) {
							handleTokenCreated(response1, response2);
						}
						else {
							handleCreateTokenError(status2, response2);
						}
					});
				}
			}
			else {
				handleCreateTokenError(status1, response1);
			}
		};

		// TODO: Learn how to inject something like Stripe, then do so.
		Stripe.createToken(creditCard, stripeResponseHandler);
	};
}
ContributeCtrl.$inject = ['session', '$scope', '$http', '$routeParams'];
