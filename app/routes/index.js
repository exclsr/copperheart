var config = require('../config.js');
/*
 * GET home page.
 */

exports.index = function(req, res){
	var params = {
		analytics: config.analytics()
	};

	res.render('index', params);
};