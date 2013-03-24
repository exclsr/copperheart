'use strict';

/* Controllers */


function HelloCtrl($scope) {

	$scope.submitPayment = function() {
		
		var creditCard = {
			number: $scope.cc.number,
			cvc: $scope.cc.cvc,
			exp_month: $scope.cc.expMonth,
			exp_year: $scope.cc.expYear
		};

		var stripeResponseHandler = function(status, response) {
			if (response.error) {
				// Show the errors on the form
				$scope.errorMessage = response.error.message;
			} else {
				var stripeToken = response.id;
				$scope.stripeToken = stripeToken;
				// Force the UI to update, like a sad person.
				$scope.$apply(); 
			}
		};

		// TODO: Learn how to inject something like Stripe, then do so.
		Stripe.createToken(creditCard, stripeResponseHandler);
	};
}
HelloCtrl.$inject = ['$scope'];


