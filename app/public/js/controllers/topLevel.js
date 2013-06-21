'use strict';

function TopLevelCtrl(session, $scope, $http) {

	// TODO: We want this code to be called when each view
	// is loaded, but that is not happening at the moment.
	// Figure out a good way to do that.
	//
	if (!session.patron.username) {
		$http.get('/whoami')
		.success(function (patron) {
			// TODO: Put role stuff in database and get via /whoami
			$http.get('/whoami/role')
			.success(function (role) {
				session.patron = patron;
				if ($scope.isSignedIn()) {
					session.patron.role = role;
				}
			})
			.error(function() {
				session.patron = patron;
			});
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

	$scope.isSignedIn = function() {
		if (session.patron.username) {
			return true;
		}

		return false;
	};

	$scope.isMember = function() {
		if (session && session.patron && session.patron.role) {
			var role = session.patron.role;
			if (role === "admin"
			||  role === "member") {
				return true;
			}
		}

		return false;
	};

	$scope.patron.getDisplayName = function () {
		if ($scope.isSignedIn()) {
			if (session && session.patron && session.patron.name) {
				return session.patron.name;
			}
		}
		return $scope.patron.getUsername();
	};

	$scope.signOut = function() {
		$http.get('/auth/signout')
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