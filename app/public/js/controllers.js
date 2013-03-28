'use strict';

/* Controllers */

function HelloCtrl($scope, $http) {

	$scope.things = [
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

		angular.forEach($scope.things, function (thing) {
			if (thing.canHaz) {
				totalPrice += thing.price;
			}
		});

		// TODO: Not sure if formatting should be in here.
		if (totalPrice === 0) {
			return totalPrice;
		}

		return totalPrice.toFixed(2);
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

		// TODO: Not sure if formatting should be in here.
		if (pricePerMonth === 0) {
			return pricePerMonth;
		}

		return pricePerMonth.toFixed(2);
	};
}
HelloCtrl.$inject = ['$scope', '$http'];

function ContributeCtrl($scope, $http) {

	$scope.submitPayment = function() {
		
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
ContributeCtrl.$inject = ['$scope', '$http'];


