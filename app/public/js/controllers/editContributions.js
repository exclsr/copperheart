'use strict';

function EditContributionsCtrl(session, $scope, $http) {

	session.pageName = "edit/contributions";
	var hasCard = false;

	$scope.hasCard = function() {
		return hasCard;
	};
	$scope.hasNoCard = function() {
		return $scope.card === {};
	}

	// TODO: this is copied from hello.js. Make a service or something.
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

	var initialize = function() {
		$scope.contributions = [];

		$http.get('/contributions')
		.success(function (data) {
			angular.forEach(data, function (contribution) {

				contribution.pricePerMonth = function() {
					var pricePerMonth = 0;

					angular.forEach(contribution.things, function (thing) {
						var itemPrice = 0;

						if (thing.canHaz && thing.recurring) {
							itemPrice = parseFloat(thing.price) * perMonthMultiplier(thing.frequency);
							pricePerMonth += itemPrice;
						}
					});

					return pricePerMonth;
				}(); // closure

				$scope.contributions.push(contribution);
			});
		})
		.error(function (data) {
			console.log(data);
		});

		$http.get('/card')
		.success(function (data) {
			if (data !== {}) {
				hasCard = true;
				$scope.card = data;
			}
		})
		.error(function (data) {
			console.log(data);
		});
	};

	initialize();



	// TODO: this is copied from hello.js. Make a service or something.
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
}
EditContributionsCtrl.$inject = ['session', '$scope', '$http'];