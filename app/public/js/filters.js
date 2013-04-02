'use strict';

/* Filters */

angular.module('myApp.filters', []).
  filter('interpolate', ['version', function(version) {
    return function(text) {
      return String(text).replace(/\%VERSION\%/mg, version);
    }
  }]).
  filter('ordinal', function() {
    return function (input) {
    	if (!angular.isNumber(input)) {
    		return input;
    	}

    	var text = "" + input;
    	var tens = text.substring(text.length-2,text.length-1);
    	var ones = text.substring(text.length-1,text.length);

    	var suffix = '';

    	if (tens === '1') {
    		suffix = 'th';
    	}
    	else {
    		switch (ones) {
    			case '1':
    				suffix = 'st';
    				break;
    			case '2':
    				suffix = 'nd';
    				break;
    			case '3':
    				suffix = 'rd';
    				break;
    			default:
    				suffix = 'th';
    				break;
    		}
    	}

    	return input + suffix;
    }
  })
  .filter('month', function() {
  	return function (input) {
  		
  		var monthNames = 
  			["January", "February", "March", "April", "May", "June",
  			"July","August","September","October","November","December"];

  		var monthNumber = parseInt(input);

  		if (angular.isNumber(monthNumber) && monthNumber >= 0 && monthNumber <= 11) {
  			return monthNames[monthNumber];
  		}
  		else {
  			return input;
  		}
  	}
  });
