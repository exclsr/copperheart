'use strict';
var assert = require("assert");

var testDbConfig = {
	useAuthentication: false,
	username: "whatever",
	password: "whatever",
	host: "http://localhost",
	port: 5984,
	name: "sandbox-test",
	secureHost: "http://localhost",
	securePort: 5984
};

var db;

beforeEach(function() {
	db = require('../../app/lib/database.js').db(testDbConfig);
});

afterEach(function (done) {
	db.onlyForTest.destroy(done);
});

describe('Database', function(){
	it('can save and get patrons', function (done) {

		var patronEmail = 'email@domain.com';
		var patron = {
			id: 'this-is-some@id',
			email: patronEmail,
			username: 'dontcare',
			backers: {},
			backing: {}
		};

		var handleError = function (error) {
			if (error) throw error;
		}

		db.init(function() {
			db.patrons.save(patron, 
				function() {
					db.patrons.get(patronEmail, function(savedPatron) {
						assert.equal(savedPatron.id, patron.id, "patron id");
						assert.equal(savedPatron.email, patron.email, "patron email");
						assert.equal(savedPatron.username, patron.username, "patron username");
						done();
					}, 
					handleError);
				},
				handleError
			);
		});
	});
	
});