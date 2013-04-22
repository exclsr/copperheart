'use strict';

function HeaderCtrl(session, $scope, $http) {

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
HeaderCtrl.$inject = ['session', '$scope', '$http'];