'use strict';

function EntranceCtrl(session, $scope, $http) {

	$scope.pageName = "entrance";
	var profiles = [];

	$http.get('/entrance/usernames')
	.success(function (usernames) {

		angular.forEach(usernames, function (username) {

			$http.get('/profile/' + username)
			.success(function (p) {
				if (p.username) {
					var profile = p;
					profile.imageUrl = "/profile/" + username + "/image";
					profiles.push(profile);

					$scope.profiles = profiles;
				}
			});
		});
	});
}
EntranceCtrl.$inject = ['session', '$scope', '$http'];