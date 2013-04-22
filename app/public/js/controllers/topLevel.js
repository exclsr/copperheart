'use strict';

function TopLevelCtrl(session, $scope) {

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
TopLevelCtrl.$inject = ['session', '$scope'];