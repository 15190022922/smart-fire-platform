import { initialSchemaMigration } from "./0001-initial-schema";

export const databaseMigrations = [initialSchemaMigration];

export type DatabaseMigration = (typeof databaseMigrations)[number];

export * from "./runner";
