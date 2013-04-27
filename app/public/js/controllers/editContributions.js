'use strict';

function EditContributionsCtrl(session, $scope, $http) {

	$scope.pageName = "edit/contributions";
	$scope.contributions = [];

	$http.get('/contributions')
	.success(function (data) {
		angular.forEach(data, function (contribution) {
			$scope.contributions.push(contribution);
		});
	})
	.error(function (data) {
		console.log(data);
	});

}
EditContributionsCtrl.$inject = ['session', '$scope', '$http'];