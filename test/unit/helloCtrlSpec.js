'use strict';

beforeEach(module('myApp.services'));

describe('HelloCtrl', function(){

  var session;
  var scope;
  var $httpBackend;
  var location;

  var ctrl;
  var username = "user";

  var initBackend = function (injector) {
    var httpBackend = injector.get('$httpBackend');
    httpBackend.when('GET', '/who/' + username)
    .respond({
      name: "Full Name",
      present: "<p>Hi.</p>",
      passions: ['good', 'things'],
      communities: ['copper', 'heart']
    });

    httpBackend.when('GET', '/things/' + username + '?n=4')
    .respond([]);

    httpBackend.when('GET', '/contributions/' + username)
    .respond([]);

    httpBackend.when('GET', '/support/' + username)
    .respond({});

    httpBackend.when('GET', '/support/' + username + '/names')
    .respond([]);

    return httpBackend;
  };

  beforeEach(inject(function ($injector, $rootScope, $controller) {
    
    $httpBackend = initBackend($injector);
    location = $injector.get('$location');

    scope = $rootScope.$new();
    session = {};

    var params = {
        $scope: scope,
        $routeParams: {
          who: username
        },
        session: session,
        $location: location
    };

    ctrl = $controller(HelloCtrl, params);
  }));

  it('has a priceNow function that works', function() {
    var basePrice = 1;
    var eachDayMultiplier = 365.0 / 12.0;
    var eachWeekMultiplier = 52.0 / 12.0;
    var eachMonthMultiplier = 1.0;

    var weeklyThing = {
       price: basePrice,
       canHaz: true,
       recurring: true,
       frequency: "week"
    };

    var monthlyThing = {
      price: basePrice,
      canHaz: true, 
      recurring: true,
      frequency: "month"
    };

  var dailyThing = {
      price: basePrice,
      canHaz: true, 
      recurring: true,
      frequency: "day"
    };

    var onceThing = {
      price: basePrice,
      canHaz: true,
      frequency: "month"
    };

    var onceThingAgain = {
      price: basePrice,
      canHaz: true,
      frequency: "month"
    };

    var notChosenThing = {
      price: (basePrice * 2)
    };

    var things = [weeklyThing, dailyThing, monthlyThing, notChosenThing, onceThing, onceThingAgain];
    scope.contributions = things;

    expect(scope.priceNow()).toBe(basePrice + basePrice);

    expect(scope.pricePerMonth()).toBe(
      basePrice * eachWeekMultiplier +
      basePrice * eachMonthMultiplier +
      basePrice * eachDayMultiplier);
  });

  it('has a page name', function () {
     expect(session.pageName).not.toBeUndefined();
  });

  it('redirects to entrance when username not present', inject(function ($controller) {
    var params = {
      $scope: scope,
      $routeParams: {},
      session: session,
      location: location
    };

    ctrl = $controller(HelloCtrl, params);
    expect(location.path()).toBe("/entrance");
  }));
});
