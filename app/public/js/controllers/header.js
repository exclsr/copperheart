'use strict';

function HeaderCtrl(session, $scope) {

	$scope.patron = {};
	$scope.patron.getUsername = function () {
		if (session && session.patron && session.patron.username) {
			return session.patron.username;
		}
		return "anonymous";
	};
}