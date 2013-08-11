'use strict';

function EditCtrl(session, $scope, $http, $routeParams) {	
	var patron = {};
	var bindToSession = function () {
		// TODO: Why is session.patron an empty object?
		patron = session.patron;
	};

	var initialize = function() {
		var member;
		$scope.subEdit = $routeParams.subEdit || 'about';

		var ready = function () {
			if (member) {
				$scope.$broadcast('member-ready', member);
			}
		};
		
		$http.get('/member')
		.success(function (memberData) {
			member = memberData;

			$http.get('/profile/' + member.username + '/static-base-url')
			.success(function (url) {
				member.staticBaseUrl = url;
				ready();
			});
		})
		.error(function(data, status, headers, config) {
			if (status === 401) {
				// We're not logged in. There is a todo task in the
				// top-level controller to address this, but in the 
				// mean time, let's force-log-out, so we can at least
				// log back in.
				$scope.signOut();
			}
			else {
				// TODO: Something terrible went wrong. Deal with it.
				console.log(data);
			}
			
		});
	};

	bindToSession();
	initialize();
}
EditCtrl.$inject = ['session', '$scope', '$http', '$routeParams'];