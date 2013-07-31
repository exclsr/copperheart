'use strict';



// Declare app level module which depends on filters, and services
angular.module('myApp', ['myApp.filters', 'myApp.services', 'myApp.directives', 'ngSanitize', 'ui']).
  config(['$routeProvider', function($routeProvider) {
    
    var hello = { templateUrl: 'partials/hello.html', controller: HelloCtrl };
    var edit = { templateUrl: 'partials/edit.html', controller: EditCtrl };

  	$routeProvider.when('/entrance', {templateUrl: 'partials/entrance', controller: EntranceCtrl});
    $routeProvider.when('/about', {templateUrl: 'partials/about.html', controller: AboutCtrl});
    // Not sure which order is best, so let's do both!
    $routeProvider.when('/:who/hello', hello);
    $routeProvider.when('/hello/:who', hello);
    $routeProvider.when('/hello/:who/background', hello);
    $routeProvider.when('/hello/:who/future', hello);
    $routeProvider.when('/hello/:who/community/:communityId', hello);
    $routeProvider.when('/hello/:who/support', hello);
    $routeProvider.when('/hello', hello);
    $routeProvider.when('/contribute', {templateUrl: 'partials/contribute.html', controller: ContributeCtrl});
    $routeProvider.when('/contribute/thanks', {templateUrl: 'partials/thanks.html', controller: ThanksCtrl});
    $routeProvider.when('/edit', {templateUrl: 'partials/edit.html', controller: EditCtrl});
    $routeProvider.when('/edit/contributions', {templateUrl: 'partials/editContributions.html', controller: EditContributionsCtrl});
    $routeProvider.when('/edit/:subEdit', {templateUrl: 'partials/edit.html', controller: EditCtrl});
    $routeProvider.otherwise({redirectTo: '/entrance'});
  }]);
