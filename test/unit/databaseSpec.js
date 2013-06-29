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
var patronEmail;
var patron;

beforeEach(function() {
	db = require('../../app/lib/database.js').db(testDbConfig);
	patronEmail = 'email@domain.com';
	patron = {
		id: 'this-is-some@id',
		email: patronEmail,
		username: 'dontcare',
		backers: {},
		backing: {}
	}
});

afterEach(function (done) {
	db.onlyForTest.destroy(done);
});

var error = function (error) {
	if (error) throw error;
}

describe('Database', function(){

	it('can save and get patrons', function (done) {
		db.init(function() {
			db.patrons.save(patron, 
				function() {
					db.patrons.get(patronEmail, function(savedPatron) {
						assert.equal(savedPatron.id, patron.id, "patron id");
						assert.equal(savedPatron.email, patron.email, "patron email");
						assert.equal(savedPatron.username, patron.username, "patron username");
						done();
					}, 
					error);
				},
				error
			);
		});
	});

	it('can update patrons', function (done) {

		var updatePatronAgain = function () {
			patron.name = "second-update";
			db.patrons.save(patron,
				function() {
					db.patrons.get(patron.email,
						function (patronData) {
							assert.equal(patron.name, patronData.name, "patron name not updated (2nd)");
							done();
						},
						error
					);
				},
				error);
		};

		var updatePatron = function() {
			patron.name = "first-update";
			patron.backers = {
				"first": "first",
				"update": "update"
			};
			db.patrons.save(patron, 
				function() {
					db.patrons.get(patron.email, 
						function (patronData) {
							assert.equal(patron.name, patronData.name, "patron name not updated");
							assert.equal(patron.backers[0], patronData.backers[0], "patron backers not updated");
							assert.equal(patron.backers[1], patronData.backers[1], "patron backers not updated");
							updatePatronAgain();
						}, 
						error
					);
				},
			error);
		};

		db.init(function() {
			db.patrons.save(patron, 
				updatePatron,
				error
			);
		});
	});

});