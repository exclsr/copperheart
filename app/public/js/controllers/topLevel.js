'use strict';

function TopLevelCtrl(session, $scope, $http) {

	// TODO: We want this code to be called when each view
	// is loaded, but that is not happening at the moment.
	// Figure out a good way to do that.
	//
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

	$scope.logout = function() {
		$http.get('/auth/logout')
		.success(function () {
			// clear out the logged in user
			session.patron = {};
			session.save();
		})
		.error(function(data, status, headers, config) {
			// TODO: Is there anything to do?
			console.log(data);
		});
	};
}
TopLevelCtrl.$inject = ['session', '$scope', '$http'];