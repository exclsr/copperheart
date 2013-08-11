'use strict';

function EditThingsCtrl(session, $scope, $http) {

	$scope.thing = {};

	var icons = [
		'glass', 'music', 'heart', 'star', 'film',
		'ok', 'off', 'signal', 'cog', 'home', 'time',
		'repeat', 'lock', 'flag', 'headphones', 'book',
		'camera', 'facetime-video', 'pencil', 'gift', 'leaf',
		'fire', 'eye-open', 'plane', 'comment', 'magnet',
		'shopping-cart', 'bullhorn', 'bell', 'certificate',
		'globe', 'wrench', 'briefcase'
	];

	$scope.$on('member-ready', function (event, member) {
		$scope.things = member.things;
	});

	// When 'things' changes, save to our database.
	// Ignore the first time things is assigned.
	$scope.$watch('things', 
		function (newValue, oldValue) {
			if (oldValue !== undefined) { 
				saveThings($scope.things);
			}
		},
		true // test if values change instead of refs
		// basically, this 'true' is needed for watching
		// the array elements.
	);

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
	};
}
EditThingsCtrl.$inject = ['session', '$scope', '$http'];