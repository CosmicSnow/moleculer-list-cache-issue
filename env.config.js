module.exports = {
	nats: process.env["NATS"] || "nats://localhost:4222",

	database: {
		database: process.env["DB"] || "",
		url: process.env["DB_URL"] || "",
		user: process.env["DB_USER"] || "",
		password: process.env["DB_PASSWORD"] || ""
	}
};
