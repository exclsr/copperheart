'use strict';

function EditAccountCtrl(session, $scope, $http) {

	var saveUsername = function(success) {
		var data = {};
		data.username = $scope.username;

		var putUsername = $http.put('/member/username', data);
		putUsername.success(function (data) {
			console.log("<3");
		});
		putUsername.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	$scope.saveUsername = function() {
		saveUsername();
	};

	$scope.$on('member-ready', function (event, member) {
		$scope.username = member.username;
		$scope.email = member.email;
		$scope.hasStripeAccount = member.hasStripeAccount;
	});

	$http.get('/stripe/connect-client-id')
	.success(function (stripeConnectClientId) {
		$scope.stripeConnectClientId = stripeConnectClientId;
	})
	.error(function() {
		// TODO: Stripe is down? Show a status.
	});
}
EditAccountCtrl.$inject = ['session', '$scope', '$http'];