"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialSchemaMigration = void 0;
const schema_1 = require("../bootstrap/schema");
exports.initialSchemaMigration = {
    id: "0001_initial_schema",
    description: "Create base schema and normalize legacy password hashes",
    up: async (client) => {
        await (0, schema_1.applyBaseSchema)(client);
        await (0, schema_1.migratePasswordHashes)(client);
    },
};
