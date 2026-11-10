import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const posts = sqliteTable("posts", { id: text("id").primaryKey(), caption: text("caption").notNull(), date: text("date").notNull(), source: text("source").notNull(), media: text("media").notNull(), bytes: integer("bytes").notNull(), favorite: integer("favorite").notNull().default(0) });
