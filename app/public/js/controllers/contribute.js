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

	var maybeMakeFakeDataForTesting = function () {
		// For testing ...
		if (!$scope.things || !$scope.things.length > 0) {
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

	bindToSession();
	maybeMakeFakeDataForTesting();

	$scope.isLoggedIn = function() {
		if (session.patron.username) {
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
ContributeCtrl.$inject = ['session', '$scope', '$http', '$routeParams'];
