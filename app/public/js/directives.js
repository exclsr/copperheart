'use strict';

var toOrdinal = function (input) {
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
};

var fromOrdinal = function (input) {
	var validSuffixes = ['st','nd','rd','th'];

	var possibleNumber = parseInt(input.substring(0,input.length-2));
	var suffix = input.substring(input.length-2,input.length);

	if (validSuffixes.indexOf(suffix) >= 0 && angular.isNumber(possibleNumber)) {
		return possibleNumber;
	}
	else {
		return input;
	}
};


/* Directives */
angular.module('myApp.directives', []).
directive('appVersion', ['version', function(version) {
	return function(scope, elm, attrs) {
	  elm.text(version);
	};
  }]).
directive('ordinal', function() {
	return {
		restrict: 'A',
		require: 'ngModel',
		link: function(scope, element, attr, ngModel) {
			function fromUser (text) {
				return fromOrdinal(text);
			}

			function toUser (text) {
				return toOrdinal(text);
			}
			ngModel.$parsers.push(fromUser);
			ngModel.$formatters.push(toUser);
		}
	};
  }).
directive('uploader', function ($parse) {
	return {
		restrict: 'A',
		link: function(scope, elem, attr, ctrl) {
			var onUpload = $parse(attr["onupload"]);
			
			elem.fileupload({
				dataType: 'json',
				done: function (e, data) {
					var res = data.result;
					if (res.error) {
						// TODO: Set a flag or something.
						console.log('error uploading file (see server log)');
					}
					else {
						if (onUpload) {
							onUpload(scope);
						}
					}
				}
			});
		}
	};
});
