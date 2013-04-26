'use strict';

/* Controllers */
function EditCtrl(session, $scope, $http) {

	$scope.pageName = "edit";
	var patron = {};

	var bindToSession = function () {
		patron = session.patron;
	};

	var initialize = function() {
		var patronRes = $http.get('/patron');
		patronRes.success(function (patron) {
			$scope.email = patron.email;
			$scope.username = patron.username;
			$scope.things = patron.things;
			$scope.name = patron.name;
			$scope.present = patron.present;
			$scope.passions = patron.passions;
			$scope.communities = patron.communities;
		});

		patronRes.error(function(data, status, headers, config) {
			if (status === 401) {
				// We're not logged in. There is a todo task in the
				// top-level controller to address this, but in the 
				// mean time, let's force-log-out, so we can at least
				// log back in.
				$scope.logout();
			}
			else {
				// TODO: Something terrible went wrong. Deal with it.
				console.log(data);
			}
			
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
	};


	var saveWho = function() {
		var who = {};
		who.name = $scope.name;
		who.present = $scope.present;

		var putWho = $http.put('/patron/who', who);
		putWho.success(function (data) {
			console.log("<3");
		});
		putWho.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};


	var saveUsername = function() {
		var data = {};
		data.username = $scope.username;

		var putUsername = $http.put('/patron/username', data);
		putUsername.success(function (data) {
			console.log("<3");
		});
		putUsername.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	$scope.saveProfile = function() {
		saveWho();
		saveUsername();
	}


	$scope.isAtCommunityLimit = function() {
		var communities = $scope.communities || [];
		return communities.length >= 5;
	};

	var saveCommunities = function (communities, callback) {
		var putCommunities = $http.put('/patron/communities', communities);
		putCommunities.success(function (data) {
			$scope.communities = communities;
			console.log("<3");
			callback();
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
		var putPassions = $http.put('/patron/passions', passions);
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
		var putThings = $http.put('/patron/things', things);

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


	$scope.addThing = function() {
		var things = $scope.things;
		var newThing = {};
		newThing.id = createThingId($scope.thing.name, things);
		newThing.name = $scope.thing.name;
		newThing.unit = $scope.thing.unit;
		newThing.price = $scope.thing.price;
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

	bindToSession();
	initialize();
}
EditCtrl.$inject = ['session', '$scope', '$http'];
