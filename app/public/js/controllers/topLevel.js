'use strict';

function TopLevelCtrl(session, $scope, $http) {

	if (!session.patron.username) {
		$http.get('/whoami')
		.success(function (patron) {
				session.patron = patron;
		})
		.error(function(data, status, headers, config) {
			// TODO: Something terrible went wrong. Deal with it.
			console.log(data);
		});
	}

	$scope.patron = {};

	$scope.patron.getUsername = function () {
		if (session && session.patron && session.patron.username) {
			return session.patron.username;
		}
		return "anonymous";
	};

	$scope.isLoggedIn = function() {
		if (session.patron.username) {
			return true;
		}

		return false;
	};
}
TopLevelCtrl.$inject = ['session', '$scope', '$http'];