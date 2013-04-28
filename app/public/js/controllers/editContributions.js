'use strict';

function EditContributionsCtrl(session, $scope, $http) {

	$scope.pageName = "edit/contributions";
	$scope.contributions = [];
	var hasCard = false;

	$scope.hasCard = function() {
		return hasCard;
	};
	$scope.hasNoCard = function() {
		return $scope.card === {};
	}

	$http.get('/contributions')
	.success(function (data) {
		angular.forEach(data, function (contribution) {
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
}
EditContributionsCtrl.$inject = ['session', '$scope', '$http'];