"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
const client_1 = require("./client");
async function withTransaction(runner) {
    return (0, client_1.withDbClient)(async (client) => {
        await client.query("BEGIN");
        try {
            const result = await runner(client);
            await client.query("COMMIT");
            return result;
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
    });
}
