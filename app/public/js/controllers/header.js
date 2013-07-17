'use strict';

function HeaderCtrl(session, $scope, $http, $location) {
	
	session.pageName = $location.path().slice(1); // remove the first /

	$scope.getPageName = function () {
		return session.pageName;
	};
}
HeaderCtrl.$inject = ['session', '$scope', '$http', '$location'];