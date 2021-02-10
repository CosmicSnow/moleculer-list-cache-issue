"use strict";

const fs = require("fs");
const DbService = require("moleculer-db");
const envConfig = require("../env.config");
const SqlAdapter = require("moleculer-db-adapter-sequelize");


/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */
const DbMixin = {
	mixins: [DbService],
	adapter: new SqlAdapter(envConfig.database.database, envConfig.database.user, envConfig.database.password, {
		host: envConfig.database.url,
		dialect: "mysql",
		pool: {
			max: 5,
			min: 0,
			idle: 10000
		},
		// logging: true
	}),

	events: {
	},

	methods: {
	},

	async started() {
	}
};

module.exports = DbMixin;
