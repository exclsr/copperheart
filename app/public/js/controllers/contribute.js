'use strict';

function ContributeCtrl(session, $scope, $http, $routeParams) {

	$scope.pageName = "contribute";

	var bindToSession = function() {

		var contributionTo = session.activeContribution.profile.username;
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
	}

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
		var nextMonth = currentMonth + 1;
		if (nextMonth === 12) {
			nextMonth = 1;
		}
		$scope.nextMonth = nextMonth;
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

	$scope.submitPayment = function() {
		
		$scope.result = "...";
		$scope.errors = {}; // clear error flags
		
		
		var creditCard = {
			number: $scope.cc.number,
			cvc: $scope.cc.cvc,
			exp_month: $scope.cc.expMonth,
			exp_year: $scope.cc.expYear
		};

		var refreshView = function() {
			// TODO: Why do we need this?
			$scope.$digest();
		};

		var makeRecurringCharges = function (patronId, things, stripeToken) {

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

		var handleTokenCreated = function (response) {
			$scope.result = ":-)";
			// makeRecurringCharges($scope.whoami, $scope.things, response.id);
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

		var stripeResponseHandler = function(status, response) {
			switch (status) {
				case 200: // ok!
					handleTokenCreated(response);
					break;

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

		// TODO: Learn how to inject something like Stripe, then do so.
		Stripe.createToken(creditCard, stripeResponseHandler);
	};
}
ContributeCtrl.$inject = ['session', '$scope', '$http', '$routeParams'];
