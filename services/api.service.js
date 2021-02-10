"use strict";

const _ = require("lodash");
const ApiGateway = require("moleculer-web");
const {UnAuthorizedError} = ApiGateway.Errors;

module.exports = {
	name: "api",
	mixins: [ApiGateway],

	settings: {
		port: process.env.PORT || 3200,

		routes: [{
			path: "/api",

			authorization: true,

			aliases: {
				// Role Based Access Control
				"POST /rbac": "rbac.createRole",
				"GET /rbac": "rbac.getRoles",
			},

			// Disable to call not-mapped actions
			mappingPolicy: "restrict",

			// Set CORS headers
			cors: {
				// Configures the Access-Control-Allow-Origin CORS header.
				origin: "*",
				// Configures the Access-Control-Allow-Methods CORS header.
				// methods: ["GET", "OPTIONS", "POST", "PUT", "DELETE"],
				// Configures the Access-Control-Allow-Headers CORS header.
				// allowedHeaders: [],
				// Configures the Access-Control-Expose-Headers CORS header.
				// exposedHeaders: [],
				// Configures the Access-Control-Allow-Credentials CORS header.
				// credentials: false,
				// Configures the Access-Control-Max-Age CORS header.
				// maxAge: 3600
			},

			// Parse body content
			bodyParsers: {
				json: {
					strict: false
				},
				urlencoded: {
					extended: false
				}
			}
		}],

		// assets: {
		// 	folder: "./public-conduit"
		// },

		// logRequestParams: "info",
		// logResponseData: "info",

		onError(req, res, err) {
			// Return with the error as JSON object
			res.setHeader("Content-type", "application/json; charset=utf-8");
			res.writeHead(err.code || 500);

			if (err.code == 422) {
				let o = {};
				err.data.forEach(e => {
					let field = e.field ? e.field.split(".").pop() : e.actual;
					o[field] = e.message;
				});

				res.end(JSON.stringify({errors: o}, null, 2));
			} else {
				const errObj = _.pick(err, ["name", "message", "code", "type", "data"]);
				res.end(JSON.stringify(errObj, null, 2));
			}
			this.logResponse(req, res, err ? err.ctx : null);
		}

	},

	methods: {
		/**
		 * Authorize the request
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		authorize(ctx, route, req) {
			let token;
			if (req.headers.authorization) {
				let type = req.headers.authorization.split(" ")[0];
				if (type === "Token" || type === "Bearer")
					token = req.headers.authorization.split(" ")[1];
			}

			return this.Promise.resolve(token)
				.then(token => {
					if (token) {
						// Verify JWT token
						return ctx.call("users.resolveToken", {token})
							.then(user => {
								if (user) {
									this.logger.info("Authenticated via JWT: ", user.username);
									// Reduce user fields (it will be transferred to other nodes)
									ctx.meta.user = _.pick(user, ["id", "username", "role", "email", "image"]);
									ctx.meta.token = token;
								}
								return user;
							})
							.catch(err => {
								// Ignored because we continue processing if user is not exist
								return null;
							});
					}
				})
				.then(user => {
					// TODO: CREATE LEVEL ACCESS METHOD TO CONTROL USER AND ACTIONS!
					if (req.$endpoint.action.auth == "required" && !user)
						return this.Promise.reject(new UnAuthorizedError());
				});
		},

		/**
		 * Convert ValidationError to RealWorld.io result
		 * @param {*} req
		 * @param {*} res
		 * @param {*} err
		 */
		/*sendError(req, res, err) {
			if (err.code == 422) {
				res.setHeader("Content-type", "application/json; charset=utf-8");
				res.writeHead(422);
				let o = {};
				err.data.forEach(e => {
					let field = e.field.split(".").pop();
					o[field] = e.message;
				});
				return res.end(JSON.stringify({
					errors: o
				}, null, 2));

			}

			return this._sendError(req, res, err);
		}*/
	},

	created() {
		// Pointer to the original function
		//this._sendError = ApiGateway.methods.sendError.bind(this);
	}


};
