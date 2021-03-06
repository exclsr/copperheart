'use strict';

function ContributeCtrl(session, $scope, $http, httpOptions, $location, $routeParams) {

	var contributionTo = undefined;
	var patron = undefined;

	var bindToSession = function() {

		contributionTo = session.activeContribution.profile.username;
		var contributions = session.contributions[contributionTo];

		$scope.things = [];
		angular.forEach(contributions, function (thing) {
			if (thing.canHaz) {
				$scope.things.push(thing);
			}
		});

		$scope.priceNow = session.activeContribution.priceNow;
		$scope.pricePerMonth = session.activeContribution.pricePerMonth;
		$scope.who = session.activeContribution.profile;

		patron = session.patron;
	};

	var initialize = function() {

		$http.get('/config/stripe-api-key', httpOptions)
		.success(function (data) {
			var stripeApiKey = data;
			// Identifies our website in the createToken call below
			Stripe.setPublishableKey(stripeApiKey);
		})
		.error(function (data, status, headers, config) {
			// TODO: We're offline.
		});

		$scope.cc = {};
		$scope.cc.expMonth = '01';

		$scope.months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
		$scope.years = [];

		// TODO: Inject date, so we can test.
		var today = new Date();
		var currentYear = today.getFullYear(); 
		$scope.cc.expYear = currentYear;
		for (var i=0; i < 25; i++) {
			$scope.years.push(currentYear);
			currentYear++;
		}

		$scope.paymentDay = Math.min(today.getDate(), 28);
		$scope.daysOfTheMonth = [];
		for (var i=1; i < 29; i++) {
			$scope.daysOfTheMonth.push(i);
		}
		// TODO: See if we can do this with our payment processor.
		// $scope.daysOfTheMonth.push('last');

		var currentMonth = today.getMonth();
		var paymentYear = today.getFullYear();
		var nextMonth = currentMonth + 1;
		if (nextMonth === 11) {
			nextMonth = 0;
			paymentYear++;
		}
		$scope.paymentMonth = nextMonth;
		$scope.paymentYear = paymentYear;
	};

	//---------------------------------------------------------
	// init
	//---------------------------------------------------------
	bindToSession();
	initialize();

	//---------------------------------------------------------
	// private, non-init methods
	//---------------------------------------------------------
	var savePatronName = function(success) {
		var who = {};
		who.name = $scope.fromName;

		var putWho = $http.put('/patron/who', who);
		putWho.success(function (data) {
			success();
		});
		putWho.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	var commitStatusOptions = {
		nothing: 'nothing',
		carding: 'carding',
		committing: 'committing',
		wrappingUp: 'wrappingUp',
		done: 'done',
		error: 'error'
	};

	var commitStatus = commitStatusOptions.nothing;

	var stepsComplete = {
		carding: false,
		oneTime: false,
		recurring: false
	};

	var resetStepsComplete = function() {
		// TODO: The JavaScript-y way
		stepsComplete.carding = false;
		stepsComplete.oneTime = false;
		stepsComplete.recurring = false;
	}

	var wrapUpContribution = function() {
		// This is called when 'makeContribution' is a success.
		commitStatus = commitStatusOptions.wrappingUp;
		$location.path('/contribute/thanks');
	}

	//---------------------------------------------------------
	// $scope methods
	//---------------------------------------------------------
	$scope.getPageName = function() {
		return session.pageName;
	};

	$scope.isSignInNeeded = function () {
		// The patron needs to log in if there
		// is a recurring payment.
		var isSignInNeeded = false;
		if ($scope.isSignedIn()) {
			return false;
		}

		angular.forEach($scope.things, function (thing) {
			if (thing.recurring && thing.canHaz) {
				isSignInNeeded = true;
				return;
			}
		});

		return isSignInNeeded;
	};

	$scope.isNameEmpty = function() {
		return !(session && session.patron && session.patron.name);
	};


	$scope.isCommitStatus = function (status) {
		if (commitStatus === commitStatusOptions[status]) {
			return true;
		}
		return false;
	};

	$scope.isStepComplete = function (step) {
		if (stepsComplete[step]) {
			return true;
		}
		return false;
	};

	$scope.isErrorHappening = function() {
		if ($scope.errors) {
			return ($scope.errors.isCard ||
				$scope.errors.isApi ||
				$scope.errors.isProgrammer);
		}

		return false;
	}

	$scope.makeContribution = function() {
		resetStepsComplete();
		commitStatus = commitStatusOptions.carding;
		$scope.errors = {}; // clear error flags

		var things = $scope.things;
		var paymentsCount = 0;
		
		var canHazRecurring = function() {
			var canHaz = false;

			if (!$scope.isSignedIn()) {
				return false;
			}

			angular.forEach(things, function (thing) {
				if (thing.canHaz) {
					if (thing.recurring) {
						canHaz = true;
					}
				}
			});

			return canHaz;
		}(); // closure

		var canHazOneTime = function() {
			var canHaz = false;

			angular.forEach(things, function (thing) {
				if (thing.canHaz) {
					if (!thing.recurring) {
						canHaz = true;
					}
				}
			});

			return canHaz;
		}(); // closure

		var numberOfTokensRequired = function() {
			var tokensRequired = 0;

			if (canHazRecurring) {
				tokensRequired++;
			}
			if (canHazOneTime) {
				tokensRequired++;
			}

			return tokensRequired;
		}(); // closure

		var creditCard = {
			name: $scope.cc.name,
			number: $scope.cc.number,
			cvc: $scope.cc.cvc,
			exp_month: $scope.cc.expMonth,
			exp_year: $scope.cc.expYear
		};

		var refreshView = function() {
			// TODO: Why do we need this?
			$scope.$digest();
		};

		// Credit: http://stackoverflow.com/a/11252167/124487
		// TODO: Probably move to the server
		var treatAsUTC = function (date) {
			var result = new Date(date);
			result.setMinutes(result.getMinutes() - result.getTimezoneOffset());
			return result;
		};

		var daysBetween = function (startDate, endDate) {
			var millisecondsPerDay = 24 * 60 * 60 * 1000;
			return (treatAsUTC(endDate) - treatAsUTC(startDate)) / millisecondsPerDay;
		};

		var maybeWrapUp = function() {
			if (paymentsCount === numberOfTokensRequired) {
				// We're done! 
				wrapUpContribution();
			}
		};

		var makeRecurringCharges = function (things, stripeToken) {
			if (!$scope.isSignedIn()) {
				console.log("Programmer error: " + 
					"Cannot make recurring charges if not logged in.");
				return;
			}

			var now = new Date();
			var paymentDate = new Date(
				$scope.paymentYear, $scope.paymentMonth, $scope.paymentDay);
			var daysUntilPayment = Math.ceil(daysBetween(now, paymentDate)); 

			var patronEmail = session.patron.email;

			// TODO: Revisit the names of these.
			var data = { 
				stripeToken: stripeToken,
				things: things,
				patronEmail: patronEmail,
				daysUntilPayment: daysUntilPayment,
				paymentDay: $scope.paymentDay
			};
				
			var res = $http.put('/commit/' + contributionTo, data);
			res.success(function(data) {
				// The server is happy.
				stepsComplete.recurring = true;
				paymentsCount++;
				maybeWrapUp();
			});

			res.error(function(data, status, headers, config) {
				console.log(data);
				// The server is sad.
				commitStatus = commitStatusOptions.error;
				// TODO: Describe what the patron can now do.
			});
		};

		var makeOneTimeCharges = function (things, stripeToken) {
			var data = { 
				stripeToken: stripeToken,
				things: things
			};

			var res = $http.put('/commit/once/' + contributionTo, data);
			res.success(function(data) {
				// The server is happy.
				stepsComplete.oneTime = true;
				paymentsCount++;
				maybeWrapUp();
			});

			res.error(function(data, status, headers, config) {
				console.log(data);
				// The server is sad.
				commitStatus = commitStatusOptions.error;
				// TODO: Describe what the patron can now do.
			});
		};

		var handleTokenCreated = function (response1, response2) {
			stepsComplete.carding = true;
			commitStatus = commitStatusOptions.committing;

			var recurringThings = [];
			var oneTimeThings = [];
			
			angular.forEach(things, function (thing) {
				if (thing.canHaz) {
					if (thing.recurring) {
						recurringThings.push(thing);
					}
					else {
						oneTimeThings.push(thing);
					}
				}
			});

			if (canHazRecurring && canHazOneTime && response2) {
				// Can haz all the things
				makeRecurringCharges(recurringThings, response1.id);
				makeOneTimeCharges(oneTimeThings, response2.id);
			}
			else if (canHazRecurring) {
				makeRecurringCharges(recurringThings, response1.id);
			}
			else if (canHazOneTime) {
				makeOneTimeCharges(oneTimeThings, response1.id);
			}

			refreshView();
		};

		var handleCardError = function (response) {
			$scope.errors.isCard = true;
			refreshView();
		};

		var handleProgrammerError = function (status, response) {
			$scope.errors.isProgrammer = true;
			console.log(status);
			console.log(response);
			refreshView();
		};

		var handleStripeApiError = function (response) {
			$scope.errors.isApi = true;
			refreshView();
		} 

		var handleUnknownResponse = function (status, response) {
			// TODO: Update the UI, maybe?
			handleProgrammerError(status, response);
		};

		var handleCreateTokenError = function (status, response) {
			commitStatus = commitStatusOptions.error;

			switch (status) {
				case 402: // request failed 
					handleCardError(response);
					break;

				case 400: case 401: 
					// bad request | unauthorized
					handleProgrammerError(status, response);
					break;

				case 500: case 502: case 503: case 504: 
					// stripe errors
					handleStripeApiError(response);
					break;

				default:
					handleUnknownResponse(status, response);
					break;
			}
		};

		var stripeResponseHandler = function(status1, response1) {
			if (status1 === 200) {
				// 200 ok!
				if (numberOfTokensRequired === 1) {
					handleTokenCreated(response1);
				}
				else if (numberOfTokensRequired === 2) {
					// Ok, we have one token. Cool. But we need two,
					// one for one-time charges and one for recurring charges.
					Stripe.createToken(creditCard, function (status2, response2) {
						if (status2 === 200) {
							handleTokenCreated(response1, response2);
						}
						else {
							handleCreateTokenError(status2, response2);
						}
					});
				}
			}
			else {
				handleCreateTokenError(status1, response1);
			}
		};

		if ($scope.isNameEmpty() && $scope.isSignedIn()) {
			savePatronName();
		}
		// TODO: Learn how to inject something like Stripe, then do so.
		Stripe.createToken(creditCard, stripeResponseHandler);
	};
}
ContributeCtrl.$inject = ['session', '$scope', '$http', 'httpOptions', '$location', '$routeParams'];
