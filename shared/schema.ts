export * from "./models/auth";

import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, boolean, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const countries = pgTable("countries", {
  id: serial("id").primaryKey(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
});

export const governorates = pgTable("governorates", {
  id: serial("id").primaryKey(),
  countryId: integer("country_id").notNull().references(() => countries.id),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
});

export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  governorateId: integer("governorate_id").notNull().references(() => governorates.id),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  countryId: integer("country_id").references(() => countries.id),
  governorateId: integer("governorate_id").references(() => governorates.id),
  areaId: integer("area_id").references(() => areas.id),
  declarationAccepted: boolean("declaration_accepted").default(false).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  activeDonationsCount: integer("active_donations_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicineCategories = pgTable("medicine_categories", {
  id: serial("id").primaryKey(),
  nameEn: varchar("name_en", { length: 100 }).notNull(),
  nameAr: varchar("name_ar", { length: 100 }).notNull(),
});

export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  donorId: varchar("donor_id").notNull().references(() => users.id),
  medicineNameEn: varchar("medicine_name_en", { length: 200 }).notNull(),
  medicineNameAr: varchar("medicine_name_ar", { length: 200 }).notNull(),
  categoryId: integer("category_id").references(() => medicineCategories.id),
  expiryDate: date("expiry_date").notNull(),
  quantities: jsonb("quantities").notNull().$type<Array<{ unit: string; quantity: number; remaining: number }>>(),
  locationDescription: text("location_description"),
  locationCoords: varchar("location_coords", { length: 100 }),
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  countryId: integer("country_id").references(() => countries.id),
  governorateId: integer("governorate_id").references(() => governorates.id),
  areaId: integer("area_id").references(() => areas.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  donationId: integer("donation_id").notNull().references(() => donations.id),
  requesterId: varchar("requester_id").notNull().references(() => users.id),
  requestedQuantities: jsonb("requested_quantities").notNull().$type<Array<{ unit: string; quantity: number }>>(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  proposedDeliveryDate: date("proposed_delivery_date"),
  proposedDeliveryTime: varchar("proposed_delivery_time", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => requests.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deliveryConfirmations = pgTable("delivery_confirmations", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => requests.id),
  donorQuantities: jsonb("donor_quantities").$type<Array<{ unit: string; quantity: number }>>(),
  recipientQuantities: jsonb("recipient_quantities").$type<Array<{ unit: string; quantity: number }>>(),
  donorConfirmedAt: timestamp("donor_confirmed_at"),
  recipientConfirmedAt: timestamp("recipient_confirmed_at"),
  matchStatus: varchar("match_status", { length: 20 }).default("pending").notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 30 }).notNull(),
  titleEn: varchar("title_en", { length: 300 }).notNull(),
  titleAr: varchar("title_ar", { length: 300 }).notNull(),
  relatedRequestId: integer("related_request_id").references(() => requests.id),
  relatedDonationId: integer("related_donation_id").references(() => donations.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const adminFlags = pgTable("admin_flags", {
  id: serial("id").primaryKey(),
  flaggedUserId: varchar("flagged_user_id").references(() => users.id),
  reason: text("reason").notNull(),
  relatedRequestId: integer("related_request_id").references(() => requests.id),
  relatedDonationId: integer("related_donation_id").references(() => donations.id),
  reviewed: boolean("reviewed").default(false).notNull(),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reportedBy: varchar("reported_by").references(() => users.id),
  reportType: varchar("report_type", { length: 50 }).default("system").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const countriesRelations = relations(countries, ({ many }) => ({
  governorates: many(governorates),
}));

export const governoratesRelations = relations(governorates, ({ one, many }) => ({
  country: one(countries, { fields: [governorates.countryId], references: [countries.id] }),
  areas: many(areas),
}));

export const areasRelations = relations(areas, ({ one }) => ({
  governorate: one(governorates, { fields: [areas.governorateId], references: [governorates.id] }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
  country: one(countries, { fields: [userProfiles.countryId], references: [countries.id] }),
  governorate: one(governorates, { fields: [userProfiles.governorateId], references: [governorates.id] }),
  area: one(areas, { fields: [userProfiles.areaId], references: [areas.id] }),
}));

export const donationsRelations = relations(donations, ({ one, many }) => ({
  donor: one(users, { fields: [donations.donorId], references: [users.id] }),
  category: one(medicineCategories, { fields: [donations.categoryId], references: [medicineCategories.id] }),
  country: one(countries, { fields: [donations.countryId], references: [countries.id] }),
  governorate: one(governorates, { fields: [donations.governorateId], references: [governorates.id] }),
  area: one(areas, { fields: [donations.areaId], references: [areas.id] }),
  requests: many(requests),
}));

export const requestsRelations = relations(requests, ({ one, many }) => ({
  donation: one(donations, { fields: [requests.donationId], references: [donations.id] }),
  requester: one(users, { fields: [requests.requesterId], references: [users.id] }),
  messages: many(messages),
  deliveryConfirmation: one(deliveryConfirmations),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  request: one(requests, { fields: [messages.requestId], references: [requests.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
}));

export const deliveryConfirmationsRelations = relations(deliveryConfirmations, ({ one }) => ({
  request: one(requests, { fields: [deliveryConfirmations.requestId], references: [requests.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  request: one(requests, { fields: [notifications.relatedRequestId], references: [requests.id] }),
  donation: one(donations, { fields: [notifications.relatedDonationId], references: [donations.id] }),
}));

export const insertCountrySchema = createInsertSchema(countries).omit({ id: true });
export const insertGovernorateSchema = createInsertSchema(governorates).omit({ id: true });
export const insertAreaSchema = createInsertSchema(areas).omit({ id: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles);
export const insertMedicineCategorySchema = createInsertSchema(medicineCategories).omit({ id: true });
export const insertDonationSchema = createInsertSchema(donations).omit({ id: true, createdAt: true });
export const insertRequestSchema = createInsertSchema(requests).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertDeliveryConfirmationSchema = createInsertSchema(deliveryConfirmations).omit({ id: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertAdminFlagSchema = createInsertSchema(adminFlags).omit({ id: true, createdAt: true });

export type Country = typeof countries.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Governorate = typeof governorates.$inferSelect;
export type InsertGovernorate = z.infer<typeof insertGovernorateSchema>;
export type Area = typeof areas.$inferSelect;
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type MedicineCategory = typeof medicineCategories.$inferSelect;
export type InsertMedicineCategory = z.infer<typeof insertMedicineCategorySchema>;
export type Donation = typeof donations.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type DeliveryConfirmation = typeof deliveryConfirmations.$inferSelect;
export type InsertDeliveryConfirmation = z.infer<typeof insertDeliveryConfirmationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type AdminFlag = typeof adminFlags.$inferSelect;
export type InsertAdminFlag = z.infer<typeof insertAdminFlagSchema>;
