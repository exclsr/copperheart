
/**
 * Module dependencies.
 */

var express = require('express')
	, routes = require('./routes')
	, user = require('./routes/user')
	, http = require('http')
	, path = require('path')
	, config = require('./config.js');

var apiKey = config.stripeApiTest(); 
var stripe = require('stripe')(apiKey);

var app = express();

app.configure(function(){
	app.set('port', config.port());
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(app.router);
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

app.get('/things/phil/', function (req, res) {
	var things = [
			{
				id: "wine",
				name: "wine",
				unit: 'glass',
				price: 5,
				frequency: 'month'
			},
			{
				id: "internet",
				name: "Internet",
				unit: 'day',
				price: 2,
				frequency: 'month'
			},
			{
				id: "groceries",
				name: "groceries",
				unit: 'day',
				price: 10,
				frequency: 'month'
			},
			{
				id: "rent",
				name: "rent",
				unit: 'day',
				price: 30,
				frequency: 'month'
			},
		];

		res.send(things);
});

// Some day we'll use jade for basic templating. 
// For now, AngularJS in /public. 
// 
// app.get('/', routes.index);
// app.get('/users', user.list);

app.put('/cc/charge/', function (req, res) {

	var stripeToken = req.body.stripeToken;
	console.log(stripeToken);

	var chargeRequest = {
		amount: 100,
		currency: 'usd',
		card: stripeToken,
		description: 'among the first tests'
	};

	stripe.charges.create(chargeRequest, function(err, chargeResponse) {
		if (err) {
			// TODO: Obviously ...
			console.log(err);
			res.send(500);
		}
		else {
			console.log(chargeResponse);
			res.send("Ok");
		}
	});

});

http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});
