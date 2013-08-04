'use strict';

function HeaderCtrl(session, $scope, $http, $location) {
	
	session.pageName = $location.path().slice(1); // remove the first /

	$scope.getPageName = function () {
		return session.pageName;
	};

	// HACK: This is a workaround for Safari not scrolling to 
	// the top of the page when we change location / views.
	$scope.scrollToTop = function () {
		$('html, body').animate({
			scrollTop: $("#topLevel").offset().top
		}, 0);
	};
}
HeaderCtrl.$inject = ['session', '$scope', '$http', '$location'];