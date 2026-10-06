import { columnExists } from "../dialect-helpers.js";
export async function up(db) {
    if (!(await columnExists(db, "credentials", "algorithm"))) {
        await db.schema
            .alterTable("credentials")
            .addColumn("algorithm", "integer", (col) => col.notNull().defaultTo(-7))
            .execute();
    }
}
export async function down(db) {
    if (await columnExists(db, "credentials", "algorithm")) {
        await db.schema.alterTable("credentials").dropColumn("algorithm").execute();
    }
}
