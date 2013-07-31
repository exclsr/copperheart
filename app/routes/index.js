var config = require('../config.js');

exports.index = function(req, res){
	var params = {
		analytics: config.analytics()
	};

	res.render('index', params);
};
