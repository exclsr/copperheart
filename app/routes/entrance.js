var config;
var profiles = [];

// TODO: How best to do dependency injection?
exports.initialize = function (config) {
	config = config;
	
	var dbConfig = config.database();
	var protocol = dbConfig.useHttps ? "https://" : "http://";
	var imageUrlBase = 
		protocol + dbConfig.host + ":" + dbConfig.port + 
		"/" + dbConfig.staticName + "/"

	var usernames = config.entranceUsernames() || [];
	var staticIds = config.entranceStaticIds() || [];
	usernames.forEach(function (username, index) {
		// Performance: In order to parallelize getting
		// the profile image and the profile data, just
		// go for it and set the imageUrl based on the
		// supplied static ids.
		//
		// The trade off doing it this way is that we
		// assume all the ids are valid, for the
		// benefit of twice-as-fast load times.
		var profile = {};
		profile.username = username;
		profile.imageUrl = imageUrlBase + staticIds[index] + "/profile.jpg";
		profiles.push(profile);
	});
};

exports.index = function (req, res) {
	if (!profiles || profiles.length < 1) {
		res.send("Please configure your entrance usernames, as there are none to be found.");
		return;
	}

	res.render('entrance', {
		profiles: profiles
	});
};