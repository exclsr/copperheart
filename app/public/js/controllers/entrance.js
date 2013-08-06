'use strict';

function EntranceCtrl(session, $scope, $http, httpOptions) {

	var profiles = [];

	$scope.getProfile = function (index) {
		return profiles[index];
	};

	$http.get('/entrance/usernames', httpOptions)
	.success(function (usernames) {
		angular.forEach(usernames, function (username) {
			var profile = {};
			profiles.push(profile);
			$scope.profiles = profiles;

			$http.get('/profile/' + username, httpOptions)
			.success(function (p) {
				if (p.username) {
					profile.name = p.name;
					profile.communities = p.communities;
				}
			});
		});
	});
}
EntranceCtrl.$inject = ['session', '$scope', '$http', 'httpOptions'];