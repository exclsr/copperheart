'use strict';


// Declare app level module which depends on filters, and services
angular.module('myApp', ['myApp.filters', 'myApp.services', 'myApp.directives']).
  config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/hello', {templateUrl: 'partials/hello.html', controller: HelloCtrl});
    $routeProvider.otherwise({redirectTo: '/hello'});
  }]);
