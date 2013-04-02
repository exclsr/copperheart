'use strict';

/* Controllers */

function HelloCtrl($scope, $http, $location, session, activeContribution) {

	if (!session.things || session.things.length < 1) {
		session.things = [
			{
				id: "wine",
				name: "wine",
				unit: 'glass',
				price: 5,
				frequency: 'month'
			},
			{
				id: "internet",
				name: "Internet",
				unit: 'day',
				price: 2,
				frequency: 'month'
			},
			{
				id: "groceries",
				name: "groceries",
				unit: 'day',
				price: 10,
				frequency: 'month'
			},
			{
				id: "rent",
				name: "rent",
				unit: 'day',
				price: 30,
				frequency: 'month'
			},
		];
	};

	$scope.things = session.things;

	// When our local 'things' changes, update our session.
	$scope.$watch('things', function() {
		session.things = $scope.things;
	});


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
			if (thing.canHaz) {
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

		$location.path('contribute');
	};
}
HelloCtrl.$inject = ['$scope', '$http', '$location', 'session', 'activeContribution'];


function ContributeCtrl($scope, $http, activeContribution) {

	$scope.things = activeContribution.things;
	$scope.priceNow = activeContribution.priceNow;
	$scope.pricePerMonth = activeContribution.pricePerMonth;

	// For testing ...
	if (!activeContribution || !activeContribution.things.length > 0) {
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
		
		console.log($scope.paymentDay);
		return;

		$scope.result = "...";

		var creditCard = {
			number: $scope.cc.number,
			cvc: $scope.cc.cvc,
			exp_month: $scope.cc.expMonth,
			exp_year: $scope.cc.expYear
		};

		var stripeResponseHandler = function(status, response) {
			if (response.error) {
				// Show the errors on the form
				$scope.errorMessage = response.error.message;
			} else {
				var data = { stripeToken: response.id };
				
				// Put a charge for $1 on the card ...
				var res = $http.put('/cc/charge/', data);
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
			}
		};

		// TODO: Learn how to inject something like Stripe, then do so.
		Stripe.createToken(creditCard, stripeResponseHandler);
	};
}
ContributeCtrl.$inject = ['$scope', '$http', 'activeContribution'];


