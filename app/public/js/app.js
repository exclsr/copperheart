'use strict';


// Declare app level module which depends on filters, and services
angular.module('myApp', ['myApp.filters', 'myApp.services', 'myApp.directives', 'ngSanitize', 'ui']).
  config(['$routeProvider', function($routeProvider) {
  	// Not sure which order is best, so let's do both!
    $routeProvider.when('/:who/hello', {templateUrl: 'partials/hello.html', controller: HelloCtrl});
    $routeProvider.when('/hello/:who', {templateUrl: 'partials/hello.html', controller: HelloCtrl});
    $routeProvider.when('/hello', {templateUrl: 'partials/hello.html', controller: HelloCtrl});
    $routeProvider.when('/contribute', {templateUrl: 'partials/contribute.html', controller: ContributeCtrl});
    $routeProvider.when('/edit', {templateUrl: 'partials/edit.html', controller: EditCtrl});
    $routeProvider.when('/edit/contributions', {templateUrl: 'partials/editContributions.html', controller: EditContributionsCtrl});
    $routeProvider.otherwise({redirectTo: '/hello/phil'});
  }]);
