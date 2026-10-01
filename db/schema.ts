import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const tournament = sqliteTable("tournament", {
  id: text("id").primaryKey(),
  state: text("state").notNull(),
  version: integer("version").notNull(),
});
