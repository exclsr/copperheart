'use strict';

/* jasmine specs for controllers go here */
beforeEach(module('myApp.services'));

describe('HelloCtrl', function(){

  var scope;
  var ctrl;
  var $httpBackend;

  beforeEach(inject(function($injector, $rootScope, $controller) {
    $httpBackend = $injector.get('$httpBackend');
    $httpBackend.when('GET', '/who/phil')
    .respond({
      name: "Phil",
      present: "<p>Hi.</p>",
      passions: ['good', 'things'],
      communities: ['copper', 'heart']
    });

    $httpBackend.when('GET', '/things/phil?n=4')
    .respond([]);

    $httpBackend.when('GET', '/contributions/phil')
    .respond([]);

    $httpBackend.when('GET', '/support/phil')
    .respond({});

    $httpBackend.when('GET', '/support/phil/names')
    .respond([]);

    scope = $rootScope.$new();
    ctrl = $controller(HelloCtrl, 
      {
        $scope: scope
      });
    
  }));

  it('should ....', function() {
    //spec body
  });
});


// TODO: Test all the controllers.
// describe('ContributeCtrl', function(){
//   var contribute;


//   beforeEach(function(){
//     contribute = new ContributeCtrl(session);
//   });


//   it('should ....', function() {
//     //spec body
//   });
// });
