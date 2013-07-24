'use strict';

/* Controllers */
function EditCtrl(session, $scope, $http, $routeParams) {

	$scope.thing = {};
	// TODO: Refactor this ugliness.
	$scope.communityImageUrlTimestamps = {};
	$scope.communityIconUrlTimestamps = {};

	var patron = {};
	var icons = [
		'glass', 'music', 'heart', 'star', 'film',
		'ok', 'off', 'signal', 'cog', 'home', 'time',
		'repeat', 'lock', 'flag', 'headphones', 'book',
		'camera', 'facetime-video', 'pencil', 'gift', 'leaf',
		'fire', 'eye-open', 'plane', 'comment', 'magnet',
		'shopping-cart', 'bullhorn', 'bell', 'certificate',
		'globe', 'wrench', 'briefcase'
	];


	var bindToSession = function () {
		patron = session.patron;
	};

	var getNewProfileImageUrl = function(username) {
		// Use a timestamp to convince everyone we need a new
		// image from the server when a new file is uploaded.
		return '/profile/' + username + '/image?' + Date.now();
	};
	var getNewBackgroundImageUrl = function(username) {
		// Use a timestamp to convince everyone we need a new
		// image from the server when a new file is uploaded.
		return '/profile/' + username + '/background/image?' + Date.now();
	};
	var getNewFutureImageUrl = function(username) {
		// Use a timestamp to convince everyone we need a new
		// image from the server when a new file is uploaded.
		return '/profile/' + username + '/future/image?' + Date.now();
	};

	// TODO: Refactor
	$scope.profileImageUploaded = function () {
		$scope.$apply(function () {
			$scope.profileImageUrl = getNewProfileImageUrl($scope.username);
		});
	};
	$scope.backgroundImageUploaded = function () {
		$scope.$apply(function () {
			$scope.backgroundImageUrl = getNewBackgroundImageUrl($scope.username);
		});
	};
	$scope.futureImageUploaded = function () {
		$scope.$apply(function () {
			$scope.futureImageUrl = getNewFutureImageUrl($scope.username);
		});
	};

	// hack ...
	$scope.communityImageUploaded = function (index) {
		$scope.$apply(function () {
			$scope.communityImageUrlTimestamps[index] = Date.now();
		});
	};
	$scope.communityIconUploaded = function (index) {
		$scope.$apply(function () {
			$scope.communityIconUrlTimestamps[index] = Date.now();
		});
	};
	// end? hack.


	var saveWho = function(success) {
		var who = {};
		who.name = $scope.name;
		who.present = $scope.present;
		who.background = $scope.background;
		who.future = $scope.future;

		// TODO: This maybe creates an extra record in the database
		// the first time this is called.
		var putWho = $http.put('/patron/who', who);
		putWho.success(function (data) {
			success();
		});
		putWho.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};


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

	$scope.saveProfile = function() {
		saveWho(saveUsername);
	}


	$scope.isAtCommunityLimit = function() {
		var communities = $scope.communities || [];
		return communities.length >= 5;
	};

	var saveCommunities = function (communities, callback) {
		var putCommunities = $http.put('/member/communities', communities);
		putCommunities.success(function (data) {
			$scope.communities = communities;
			console.log("<3");
			if (callback) {
				callback();	
			}
		});
		putCommunities.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	$scope.saveCommunity = function() {
		var communities = [];
		// Prepare passions for the server, while keeping our
		// UI the same. TODO: What do we want to do -- wait
		// to hear from the server before updating the UI,
		// or to be "responsive." Let's start with being
		// honest about what is happening, then go from there.
		angular.forEach($scope.communities, function (community) {
			communities.push(community);
		});
		communities.push($scope.newCommunity);

		saveCommunities(communities, function() {
			$scope.newCommunity = {};
			$scope.newCommunity.url = "";
			$scope.newCommunity.name = "";
			$scope.newCommunity.photoCredit = "";
		});
	};

	$scope.deleteCommunity = function(communityToDelete) {
		var communitiesToKeep = [];
		// TODO: Rumor is that animations are coming in the next
		// release of AngularJS for this sort of thing, so hold
		// tight for now.
		angular.forEach($scope.communities, function (community) {
			if (community !== communityToDelete) {
				communitiesToKeep.push(community);
			}
		});

		saveCommunities(communitiesToKeep);
	};


	$scope.isAtPassionLimit = function() {
		var passions = $scope.passions || [];
		return passions.length >= 3;
	};

	var savePassions = function (passions, callback) {
		var putPassions = $http.put('/member/passions', passions);
		putPassions.success(function (data) {
			$scope.passions = passions;
			console.log("<3");
			callback();
		});
		putPassions.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	$scope.savePassion = function() {
		var passions = [];
		// Prepare passions for the server, while keeping our
		// UI the same. TODO: What do we want to do -- wait
		// to hear from the server before updating the UI,
		// or to be "responsive." Let's start with being
		// honest about what is happening, then go from there.
		angular.forEach($scope.passions, function (passion) {
			passions.push(passion);
		});
		passions.push($scope.newPassion);

		savePassions(passions, function() {
			$scope.newPassion = "";
		});
	};

	$scope.deletePassion = function(passionToDelete) {
		var passionsToKeep = [];
		// TODO: Rumor is that animations are coming in the next
		// release of AngularJS for this sort of thing, so hold
		// tight for now.
		angular.forEach($scope.passions, function (passion) {
			if (passion !== passionToDelete) {
				passionsToKeep.push(passion);
			}
		});

		savePassions(passionsToKeep);
	};


	var saveThings = function (things) {
		var putThings = $http.put('/member/things', things);

		putThings.success(function (data) {
			console.log(data);
		});

		putThings.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	var createThingId = function (thingName, things) {
		// TODO: I guess we could do this on the server 
		// side, but why not distribute the computing, eh?
		var newThingId = thingName;
		var canUseThingId = false;
		var loopCount = 1;

		while (!canUseThingId) {
			var duplicateIdFound = false;

			angular.forEach(things, function (thing) {
				// If our proposed newThingId is already
				// being used, try again.
				if (thing.id === newThingId) {
					duplicateIdFound = true;
					loopCount++;
					newThingId = thingName + loopCount.toString();
					return;
				}
			});

			if (!duplicateIdFound) {
				canUseThingId = true;
			}
		}

		return newThingId;
	};

	var parseNumber = function (maybeNumber) {
		if (angular.isNumber(maybeNumber)) {
			return maybeNumber;
		}
		else {
			var parsedNumber = parseFloat(maybeNumber);
			if (parsedNumber === NaN) {
				return 0;
			}
			else {
				return parsedNumber;
			}
		}
	};

	$scope.areEqual = function (x, y) {
		return x === y;
	};


	$scope.setNewThingGlyph = function (glyphName) {
		$scope.thing.glyph = glyphName;
	};

	$scope.addThing = function() {
		var things = $scope.things;
		var newThing = {};
		newThing.id = createThingId($scope.thing.name, things);
		newThing.name = $scope.thing.name;
		newThing.unit = $scope.thing.unit;
		newThing.price = parseNumber($scope.thing.price);
		newThing.glyph = $scope.thing.glyph;
		newThing.goal = $scope.thing.goal;
		newThing.frequency = "month"; // TODO: Don't need this?

		things.push(newThing);
		$scope.things = things;
	};


	$scope.deleteThing = function(thingToDelete) {
		var thingsToKeep = [];
		// TODO: Rumor is that animations are coming in the next
		// release of AngularJS for this sort of thing, so hold
		// tight for now.
		angular.forEach($scope.things, function(thing) {
			if (thing.id !== thingToDelete.id) {
				thingsToKeep.push(thing);
			}
		});

		$scope.things = thingsToKeep;
	};

	$scope.markThingsAsChanged = function () {
		$scope.$apply('things');
	};

	$scope.getIcons = function () {
		return icons;
	}


	var initialize = function() {
		
		$scope.subEdit = $routeParams.subEdit || 'profile';
		
		var memberRes = $http.get('/member');
		memberRes.success(function (member) {
			$scope.email = member.email;
			$scope.username = member.username;
			$scope.things = member.things;
			$scope.name = member.name;
			$scope.present = member.present;
			$scope.background = member.background;
			$scope.future = member.future;
			$scope.passions = member.passions;
			$scope.communities = member.communities;
			$scope.hasStripeAccount = member.hasStripeAccount;

			$scope.profileImageUrl = getNewProfileImageUrl(member.username);
			$scope.backgroundImageUrl = getNewBackgroundImageUrl(member.username);
			$scope.futureImageUrl = getNewFutureImageUrl(member.username);
			for (var i=0; i < member.communities.length; i++) {
				$scope.communityImageUrlTimestamps[i] = Date.now();
				$scope.communityIconUrlTimestamps[i] = Date.now();
			}
		});

		memberRes.error(function(data, status, headers, config) {
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

		$http.get('/stripe/connect-client-id')
		.success(function (stripeConnectClientId) {
			$scope.stripeConnectClientId = stripeConnectClientId;
		})
		.error(function() {
			// TODO: Stripe is down? Show a status.
		});

		// When 'things' changes, save to our database.
		// Ignore the first time things is assigned.
		$scope.$watch('things', 
			function(newValue, oldValue) {
				if (oldValue !== undefined) { 
					saveThings($scope.things);
				}
			},
			true // test if values change instead of refs
			// basically, this 'true' is needed for watching
			// the array elements.
		);

		$scope.$watch('communities',
			function (newValue, oldValue) {
				// TODO: This is just a hack to get things
				// moving. We don't want to save to the 
				// database with every keystroke. Something
				// like this is great for stress testing, though.
				if (oldValue !== undefined) {
					saveCommunities(newValue);
				}
			},
			true
		);
		$scope.$watch('background', 
			function (newValue, oldValue) {
				if (oldValue !== undefined) {
					saveWho(function() {});
				}
			},
			true
		);
		$scope.$watch('future', 
			function (newValue, oldValue) {
				if (oldValue !== undefined) {
					saveWho(function() {});
				}
			},
			true
		);
	};

	bindToSession();
	initialize();
}
EditCtrl.$inject = ['session', '$scope', '$http', '$routeParams'];
