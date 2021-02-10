"use strict";

const {MoleculerClientError} = require("moleculer").Errors;
const envConfig = require("../env.config");
const DbService = require("moleculer-db");
const SqlAdapter = require("moleculer-db-adapter-sequelize");
const Sequelize = require("sequelize");
const DbMixin = require("../mixins/db.mixin");
const Op = Sequelize.Op;
// const { v4: uuidv4 } = require('uuid');

const optionalEntries = {
	name: {type: "string", convert: true, optional: true},
	description: {type: "string", optional: true, default: ""},
	permissions: {type: "array", optional: true, default: [], empty: true},
	active: {type: "boolean", optional: true, default: true}
};

const requiredEntries = {}
Object.keys(optionalEntries).forEach(entity => {
	if (entity === 'id') return;
	requiredEntries[entity] = {...optionalEntries[entity]};
	delete requiredEntries[entity].optional;
});

module.exports = {
	name: "rbac",
	mixins: [DbMixin],
	settings: {
		/** Public fields */
		// fields: ["id", "role", "username", "email", "bio", "image"],
	},

	model: {
		name: "rbac",
		define: {
			// id: {type: Sequelize.UUIDV4, primaryKey: true},
			name: {type: Sequelize.STRING},
			description: {type: Sequelize.STRING},
			permissions: {type: Sequelize.STRING},
			active: {type: Sequelize.BOOLEAN, default: true},
		},
		options: {
			// Options from http://docs.sequelizejs.com/manual/tutorial/models-definition.html
			paranoid: true
		}
	},

	async afterConnected() {
		try {
			await this.adapter.insertMany([{
					id: 1,
					name: "Role One",
					description: 'somedesc',
					permissions: 'potato,tomato',
					active: true,
				},{
					id: 2,
					name: "Role One",
					description: 'somedesc',
					permissions: 'potato,tomato',
					active: true,
				},{
					id: 3,
					name: "Role One",
					description: 'somedesc',
					permissions: 'potato,tomato2',
					active: true,
				}],
				{ignoreDuplicates: true}).catch(e => {
				console.log(e);
			});
		} catch (e) {

		}
	},

	actions: {
		// Returns array containing all permissions name.
		listAllPermissions: {
			cache: false,
			async handler() {
				const allActions = await this.broker.call("$node.actions");
				let permissions = [];
				allActions.forEach(unitatis => {
					if (unitatis.action.permissions) {
						const actionPermission = unitatis.action.permissions.name;
						if (Array.isArray(actionPermission)) {
							permissions = permissions.concat(actionPermission);
						} else {
							permissions.push(actionPermission);
						}
					}
				});
				return permissions;
			}
		},

		// Returns array containing all permissions objects.
		getAllPermissions: {
			cache: false,
			async handler() {
				const allActions = await this.broker.call("$node.actions");
				let permissions = [];
				allActions.forEach(unitatis => {
					if (unitatis.action.permissions) {
						const actionPermission = unitatis.action.permissions;
						permissions.push(actionPermission);
					}
				});
				return permissions;
			}
		},

		createRole: {
			params: {
				...optionalEntries, $$strict: true
			},
			async handler({params}) {
				let roleExists = await this.adapter.findOne({where: {name: params.name}});
				if (roleExists) {
					return Promise.reject(new MoleculerClientError("Role already exists", 422, "asd", [{
						field: "name",
						message: "role already exists",
					}, {
						field: "tag",
						message: "BACK_ERROR_ROLE_NAME_ALREADY_EXISTS",
					}]));
				} else {
					const permissions = params.permissions.toString()
					return this.adapter.insert({
						name: params.name,
						description: params.description,
						permissions: permissions,
						active: params.active
					}).then(result => {
						this.broker.cacher.clean("rbac.**");
						return result;
					});
				}
			}
		},

		getRoles: {
			// cache: true,
			params: {
				page: {type: "number", convert: true, default: 1},
				pageSize: {type: "number", convert: true, default: 10, min: 5, max: 100},
				sort: {type: "string", optional: true},
				name: {type: "string", convert: true, optional: true},
				description: {type: "string", optional: true},
				permissions: [
					{type: "array", optional: true, empty: true},
					{type: "string", optional: true}
				],
				active: {type: "boolean", convert: true, optional: true},
				$$strict: true
			},
			handler({params}) {
				let {page, pageSize, sort, ...request} = params;
				let query = {};
				console.log(12, request);
				for (let prop in request) {
					query[prop] = {[Op.like]: `%` + request[prop] + `%`}
				}
				console.log(34, query);
				return this.broker.call("rbac.list", {
					page,
					pageSize,
					maxPageSize: 100,
					sort,
					query: query
				});
			}
		},
		// list: {
		// 	cache: false
		// }

	},
	methods: {},
	events: {}
};
