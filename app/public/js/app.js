'use strict';


// Declare app level module which depends on filters, and services
angular.module('myApp', ['myApp.filters', 'myApp.services', 'myApp.directives', 'ngSanitize', 'ui']).
  config(['$routeProvider', function($routeProvider) {
  	$routeProvider.when('/entrance', {templateUrl: 'partials/entrance.html', controller: EntranceCtrl});
    $routeProvider.when('/about', {templateUrl: 'partials/about.html', controller: AboutCtrl});
    // Not sure which order is best, so let's do both!
    $routeProvider.when('/:who/hello', {templateUrl: 'partials/hello.html', controller: HelloCtrl});
    $routeProvider.when('/hello/:who', {templateUrl: 'partials/hello.html', controller: HelloCtrl});
    $routeProvider.when('/hello', {templateUrl: 'partials/hello.html', controller: HelloCtrl});
    $routeProvider.when('/contribute', {templateUrl: 'partials/contribute.html', controller: ContributeCtrl});
    $routeProvider.when('/contribute/thanks', {templateUrl: 'partials/thanks.html', controller: ThanksCtrl});
    $routeProvider.when('/edit', {templateUrl: 'partials/edit.html', controller: EditCtrl});
    $routeProvider.when('/edit/contributions', {templateUrl: 'partials/editContributions.html', controller: EditContributionsCtrl});
    $routeProvider.otherwise({redirectTo: '/entrance'});
  }]);
