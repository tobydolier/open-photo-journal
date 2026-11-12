import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  caption: text("caption").notNull(),
  date: text("date").notNull(),
  source: text("source").notNull(),
  media: text("media").notNull(),
  bytes: integer("bytes").notNull(),
  favorite: integer("favorite").notNull().default(0),
  sortOrder: integer("sort_order"),
});
export const interestSignups = sqliteTable("interest_signups", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  consentedAt: text("consented_at").notNull(),
  createdAt: text("created_at").notNull(),
});
export const featuredPhotos = sqliteTable("featured_photos", {
  slot: integer("slot").primaryKey(),
  postId: text("post_id").notNull(),
  mediaKey: text("media_key").notNull(),
});
export const photoFrames = sqliteTable("photo_frames", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  mediaKey: text("media_key").notNull(),
  style: text("style").notNull(),
});
