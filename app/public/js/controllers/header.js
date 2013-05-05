'use strict';

function HeaderCtrl(session, $scope, $http) {
	
	$scope.getPageName = function () {
		return session.pageName;
	};
}
HeaderCtrl.$inject = ['session', '$scope', '$http'];