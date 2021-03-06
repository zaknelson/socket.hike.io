"use strict";

var pg = require("pg");
var port = parseInt(process.env.PORT, 10) || 8080;
var socketIo = require("socket.io").listen(port);

socketIo.configure(function () { 
	socketIo.set("log level", 2);
	socketIo.set("origins", "hike.io:*");
});

var connectionString = process.env.DATABASE_URL || "postgres://localhost/hikeio";
var client = new pg.Client(connectionString);
client.connect();

socketIo.sockets.on("connection", function (socket) {
	socket.on("get-hikes-in-bounds", function (data) {

		console.log("Getting hikes in bounds:", data);

		// Longitude is tricky because it can jump from 179 to -179 across the international date line
		var longitudeWhereClause;
		if (data.sw.longitude < data.ne.longitude) {
			longitudeWhereClause = "(locations.longitude >= $3 AND locations.longitude <= $4)";
		} else {
			longitudeWhereClause = "(locations.longitude >= $3 OR locations.longitude <= $4)";
		}

		var queryString =  "SELECT hikes.string_id, hikes.name, hikes.distance, locations.latitude, locations.longitude \
							FROM hikes, locations \
							WHERE locations.latitude >= $1 AND \
								locations.latitude <= $2 AND " + longitudeWhereClause + " AND \
								hikes.location_id = locations.id \
							ORDER BY locations.latitude, locations.longitude;";
		client.query(queryString, [data.sw.latitude, data.ne.latitude, data.sw.longitude, data.ne.longitude], function(err, result) {
			if (!result) {
				console.log(err);
				return;
			}
			console.log("Found " + result.rows.length + " hikes");
			socket.emit("get-hikes-in-bounds", result.rows);
		});
	});
});