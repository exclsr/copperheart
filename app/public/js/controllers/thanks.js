'use strict';

function ThanksCtrl(session, $scope, $http) {

	var toMember = session.activeContribution.profile;
	var contributions = session.contributions[toMember.username];

	$scope.toName = toMember.name;
	$scope.toUsername = toMember.username;
	$scope.isNoteSent = false;

	$scope.sendNote = function() {
		var json = {};
		json.note = $scope.note;
		$scope.isNoteSent = false;

		$http.put('/commit/' + toMember.username + '/note', json)
		.success(function (data) {
			$scope.isNoteSent = true;
		})
		.error (function (data, status, headers, config) {
			console.log(data);
		});
	};
}
ThanksCtrl.$inject = ['session', '$scope', '$http'];