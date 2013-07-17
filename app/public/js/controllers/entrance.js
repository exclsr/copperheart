'use strict';

function EntranceCtrl(session, $scope, $http) {

	var profiles = [];

	$http.get('/entrance/usernames')
	.success(function (usernames) {
		angular.forEach(usernames, function (username) {
			// Performance: In order to parallelize getting
			// the profile image and the profile data, just
			// go for it and set the imageUrl based on the
			// username.
			//
			// The trade off doing it this way is that we
			// assume all the usernames are valid, for the
			// benefit of twice-as-fast load times.
			var profile = {};
			profile.username = username;
			profile.imageUrl = "/profile/" + username + "/image";
			profiles.push(profile);
			$scope.profiles = profiles;

			$http.get('/profile/' + username)
			.success(function (p) {
				if (p.username) {
					profile.name = p.name;
					profile.communities = p.communities;
				}
			});
		});
	});
}
EntranceCtrl.$inject = ['session', '$scope', '$http'];