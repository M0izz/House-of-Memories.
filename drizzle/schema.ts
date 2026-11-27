import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const birthdaySettings = sqliteTable("birthday_settings", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull(),
  recipientName: text("recipient_name").notNull().default("Maya"),
  birthMonth: integer("birth_month").notNull().default(11),
  birthDay: integer("birth_day").notNull().default(24),
  initialYear: integer("initial_year").notNull().default(2027),
  timezone: text("timezone").notNull().default("UTC"),
  deliveryTime: text("delivery_time").notNull().default("09:00"),
  countdownWidgetEnabled: integer("countdown_widget_enabled").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  spaceId: text("space_id").notNull(),
  birthdayNotificationsEnabled: integer("birthday_notifications_enabled").notNull().default(1),
  dayBeforeReminderEnabled: integer("day_before_reminder_enabled").notNull().default(1),
  preferredTime: text("preferred_time").notNull().default("09:00"),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const notificationDeliveries = sqliteTable("notification_deliveries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  spaceId: text("space_id").notNull(),
  notificationType: text("notification_type").notNull(),
  targetYear: integer("target_year").notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  deliveredAt: text("delivered_at"),
  createdAt: text("created_at").notNull(),
});

export const albums = sqliteTable("albums", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  coverMemoryId: text("cover_memory_id"),
  coverImageUrl: text("cover_image_url"),
  createdBy: text("created_by").notNull(),
  isFavorite: integer("is_favorite").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  spaceId: text("space_id").notNull(),
  title: text("title"),
  caption: text("caption"),
  story: text("story"),
  capturedAt: text("captured_at"),
  location: text("location"),
  imageUrl: text("image_url").notNull(),
  mediaType: text("media_type").notNull().default("image"),
  isFavorite: integer("is_favorite").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const albumMemories = sqliteTable("album_memories", {
  id: text("id").primaryKey(),
  albumId: text("album_id").notNull(),
  memoryId: text("memory_id").notNull(),
  addedBy: text("added_by").notNull(),
  createdAt: text("created_at").notNull(),
});
