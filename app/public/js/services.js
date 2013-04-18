'use strict';

/* Services */


// Demonstrate how to register services
// In this case it is a simple value service.
angular.module('myApp.services', []).
  value('version', '0.3').
  factory('session', function() {
  	return {
      patron: {},
      activeContribution: {
        profile: {},
        priceNow: 0,
        pricePerMonth: 0
      },
      contributions: []
  	};
  });

