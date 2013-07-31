var config;
var profiles = [];

// TODO: How best to do dependency injection?
exports.initialize = function (config) {
	config = config;

	var usernames = config.entranceUsernames() || [];
	usernames.forEach(function (username) {
		// Performance: In order to parallelize getting
		// the profile image and the profile data, just
		// go for it and set the imageUrl based on the
		// username.
		//
		// The trade off doing it this way is that we
		// assume all the usernames are valid, for the
		// benefit of twice-as-fast load times.
		var profile = {};
		profile.username = username;
		profile.imageUrl = "/profile/" + username + "/image";
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