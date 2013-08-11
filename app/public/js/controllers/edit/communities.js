'use strict';

function EditCommunitiesCtrl(session, $scope, $http) {

	var staticBaseUrl;
	// TODO: Refactor this ugliness.
	var communityImageUrlTimestamps = {};
	var communityIconUrlTimestamps = {};

	$scope.$on('member-ready', function (event, member) {
		staticBaseUrl = member.staticBaseUrl;
		$scope.communities = member.communities;
		$scope.passions = member.passions;
	
		for (var i=0; i < member.communities.length; i++) {
			communityImageUrlTimestamps[i] = Date.now();
			communityIconUrlTimestamps[i] = Date.now();
		}
	});

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

	$scope.isAtCommunityLimit = function() {
		var communities = $scope.communities || [];
		return communities.length >= 5;
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


	// $scope.isAtPassionLimit = function() {
	// 	var passions = $scope.passions || [];
	// 	return passions.length >= 3;
	// };

	// var savePassions = function (passions, callback) {
	// 	var putPassions = $http.put('/member/passions', passions);
	// 	putPassions.success(function (data) {
	// 		$scope.passions = passions;
	// 		console.log("<3");
	// 		callback();
	// 	});
	// 	putPassions.error(function (data, status, headers, config) { 
	// 		// TODO: Oh ... no.
	// 		console.log(data);
	// 	});
	// };

	// $scope.savePassion = function() {
	// 	var passions = [];
	// 	// Prepare passions for the server, while keeping our
	// 	// UI the same. TODO: What do we want to do -- wait
	// 	// to hear from the server before updating the UI,
	// 	// or to be "responsive." Let's start with being
	// 	// honest about what is happening, then go from there.
	// 	angular.forEach($scope.passions, function (passion) {
	// 		passions.push(passion);
	// 	});
	// 	passions.push($scope.newPassion);

	// 	savePassions(passions, function() {
	// 		$scope.newPassion = "";
	// 	});
	// };

	// $scope.deletePassion = function(passionToDelete) {
	// 	var passionsToKeep = [];
	// 	// TODO: Rumor is that animations are coming in the next
	// 	// release of AngularJS for this sort of thing, so hold
	// 	// tight for now.
	// 	angular.forEach($scope.passions, function (passion) {
	// 		if (passion !== passionToDelete) {
	// 			passionsToKeep.push(passion);
	// 		}
	// 	});

	// 	savePassions(passionsToKeep);
	// };

	$scope.getCommunityImageUrl = function(community, index) {
		if (!staticBaseUrl) {
			return undefined;
		}
		return staticBaseUrl + community.name + ".jpg?" + communityImageUrlTimestamps[index];
	};

	$scope.getCommunityIconUrl = function(community, index) {
		if (!staticBaseUrl) {
			return undefined;
		}
		return staticBaseUrl + community.name + "icon.jpg?" + communityImageUrlTimestamps[index];
	};

	// hack ...
	$scope.communityImageUploaded = function (index) {
		$scope.$apply(function () {
			communityImageUrlTimestamps[index] = Date.now();
		});
	};
	$scope.communityIconUploaded = function (index) {
		$scope.$apply(function () {
			communityIconUrlTimestamps[index] = Date.now();
		});
	};
	// end? hack.

	$scope.$watch('communities',
		function (newValue, oldValue) {
			// // TODO: This is just a hack to get things
			// // moving. We don't want to save to the 
			// // database with every keystroke. Something
			// // like this is great for stress testing, though.
			if (oldValue !== undefined) {
				saveCommunities(newValue);
			}
		},
		true
	);
}
EditCommunitiesCtrl.$inject = ['session', '$scope', '$http'];