'use strict';

function EditAboutCtrl(session, $scope, $http) {

	var placeholderUrl = "/img/placeholder.png";
	$scope.profileImageUrl = placeholderUrl;

	var staticBaseUrl;
	var getImageUrl = function(url, callback) {
		callback(url);
		// TODO: This doesn't work on localhost due to CORS
		// $http.head(url)
		// .success(function() {
		// 	console.log(url);
		// 	callback(url);
		// }) 
		// .error(function() {
		// 	console.log(placeholderUrl);
		// 	callback(placeholderUrl);
		// });
	};

	var getNewProfileImageUrl = function(username, callback) {
		// Use a timestamp to convince everyone we need a new
		// image from the server when a new file is uploaded.
		getImageUrl(staticBaseUrl + 'profile.jpg?' + Date.now(), callback);
	};
	var getNewBackgroundImageUrl = function(username) {
		// Use a timestamp to convince everyone we need a new
		// image from the server when a new file is uploaded.
		return staticBaseUrl + 'background.jpg?' + Date.now();
	};
	var getNewFutureImageUrl = function(username) {
		// Use a timestamp to convince everyone we need a new
		// image from the server when a new file is uploaded.
		return staticBaseUrl + 'future.jpg?' + Date.now();
	};

	var saveWho = function(success) {
		var who = {};
		who.name = $scope.name;
		who.present = $scope.present;
		who.background = $scope.background;
		who.future = $scope.future;

		var putWho = $http.put('/member/who', who);
		putWho.success(function (data) {
			if (success) {
				success();
			}
		});
		putWho.error(function (data, status, headers, config) { 
			// TODO: Oh ... no.
			console.log(data);
		});
	};

	$scope.$on('member-ready', function (event, member) {
		$scope.username = member.username;
		$scope.name = member.name;
		$scope.present = member.present;
		$scope.background = member.background;
		$scope.future = member.future;

		$scope.photoCredits = member.photoCredits;

		staticBaseUrl = member.staticBaseUrl;
		getNewProfileImageUrl(member.username, function (url) {
			$scope.profileImageUrl = url;
		});
		$scope.backgroundImageUrl = getNewBackgroundImageUrl(member.username);
		$scope.futureImageUrl = getNewFutureImageUrl(member.username);
	});

	$scope.saveWho = function() {
		saveWho();
	};

	// TODO: Refactor
	$scope.profileImageUploaded = function () {
		$scope.$apply(function () {
			getNewProfileImageUrl($scope.username, function (url) {
				$scope.profileImageUrl = url;
			});
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

	var savePhotoCredits = function (photoCredits, callback) {
		var putPhotoCredits = $http.put('/member/photo-credits', photoCredits);
		putPhotoCredits.success(function (data) {
			$scope.photoCredits = photoCredits;
			console.log("<3");
			if (callback) {
				callback();
			}
		});
		putPhotoCredits.error(function (data, status, headers, config) {
			console.log(data);
		});
	};

	$scope.$watch('photoCredits', 
		function (newValue, oldValue) {
			if (oldValue !== undefined) {
				savePhotoCredits(newValue);
			}
		},
		true
	);
}
EditAboutCtrl.$inject = ['session', '$scope', '$http'];