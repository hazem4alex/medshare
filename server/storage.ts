import {
  type UserProfile, type InsertUserProfile,
  type Country, type InsertCountry,
  type Governorate, type InsertGovernorate,
  type Area, type InsertArea,
  type MedicineCategory, type InsertMedicineCategory,
  type Donation, type InsertDonation,
  type Request, type InsertRequest,
  type Message, type InsertMessage,
  type DeliveryConfirmation, type InsertDeliveryConfirmation,
  type AdminFlag, type InsertAdminFlag,
  countries, governorates, areas, userProfiles,
  medicineCategories, donations, requests, messages,
  deliveryConfirmations, adminFlags,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, or, ilike, gte, sql, desc, asc } from "drizzle-orm";
import { seedCountries, seedGovernorates } from "./seed-locations";

export interface IStorage {
  getCountries(): Promise<Country[]>;
  getGovernoratesByCountry(countryId: number): Promise<Governorate[]>;
  getAreasByGovernorate(governorateId: number): Promise<Area[]>;

  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;

  getCategories(): Promise<MedicineCategory[]>;
  createCategory(cat: InsertMedicineCategory): Promise<MedicineCategory>;
  deleteCategory(id: number): Promise<void>;

  createDonation(donation: InsertDonation): Promise<Donation>;
  getDonation(id: number): Promise<Donation | undefined>;
  getDonationsByDonor(donorId: string): Promise<Donation[]>;
  searchDonations(params: {
    search?: string;
    categoryId?: number;
    governorateId?: number;
    countryId?: number;
  }): Promise<any[]>;
  updateDonationQuantities(id: number, quantities: any[]): Promise<void>;
  updateDonationStatus(id: number, status: string): Promise<void>;

  createRequest(req: InsertRequest): Promise<Request>;
  getRequest(id: number): Promise<any>;
  getRequestsByDonation(donationId: number): Promise<any[]>;
  getRequestsByRequester(requesterId: string): Promise<any[]>;
  updateRequestStatus(id: number, status: string, deliveryDate?: string, deliveryTime?: string): Promise<void>;

  createMessage(msg: InsertMessage): Promise<Message>;
  getMessagesByRequest(requestId: number): Promise<any[]>;

  createDeliveryConfirmation(conf: InsertDeliveryConfirmation): Promise<DeliveryConfirmation>;
  getDeliveryConfirmation(requestId: number): Promise<DeliveryConfirmation | undefined>;
  updateDeliveryConfirmation(id: number, data: Partial<DeliveryConfirmation>): Promise<void>;

  createAdminFlag(flag: InsertAdminFlag): Promise<AdminFlag>;
  getAdminFlags(): Promise<any[]>;
  markFlagReviewed(id: number, reviewedBy: string): Promise<void>;

  getActiveDonationsCount(userId: string): Promise<number>;
  getDashboardStats(userId: string): Promise<any>;

  seedInitialData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCountries(): Promise<Country[]> {
    return db.select().from(countries).orderBy(asc(countries.nameEn));
  }

  async getGovernoratesByCountry(countryId: number): Promise<Governorate[]> {
    return db.select().from(governorates).where(eq(governorates.countryId, countryId)).orderBy(asc(governorates.nameEn));
  }

  async getAreasByGovernorate(governorateId: number): Promise<Area[]> {
    return db.select().from(areas).where(eq(areas.governorateId, governorateId)).orderBy(asc(areas.nameEn));
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile;
  }

  async upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [result] = await db
      .insert(userProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          countryId: profile.countryId,
          governorateId: profile.governorateId,
          areaId: profile.areaId,
          declarationAccepted: profile.declarationAccepted,
        },
      })
      .returning();
    return result;
  }

  async getCategories(): Promise<MedicineCategory[]> {
    return db.select().from(medicineCategories).orderBy(asc(medicineCategories.nameEn));
  }

  async createCategory(cat: InsertMedicineCategory): Promise<MedicineCategory> {
    const [result] = await db.insert(medicineCategories).values(cat).returning();
    return result;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(medicineCategories).where(eq(medicineCategories.id, id));
  }

  async createDonation(donation: InsertDonation): Promise<Donation> {
    const [result] = await db.insert(donations).values(donation).returning();
    await db
      .update(userProfiles)
      .set({ activeDonationsCount: sql`${userProfiles.activeDonationsCount} + 1` })
      .where(eq(userProfiles.userId, donation.donorId));
    return result;
  }

  async getDonation(id: number): Promise<Donation | undefined> {
    const [result] = await db.select().from(donations).where(eq(donations.id, id));
    return result;
  }

  async getDonationsByDonor(donorId: string): Promise<Donation[]> {
    return db.select().from(donations).where(eq(donations.donorId, donorId)).orderBy(desc(donations.createdAt));
  }

  async searchDonations(params: {
    search?: string;
    categoryId?: number;
    governorateId?: number;
    countryId?: number;
  }): Promise<any[]> {
    const conditions = [
      eq(donations.status, "active"),
      gte(donations.expiryDate, sql`CURRENT_DATE`),
    ];

    if (params.countryId) {
      conditions.push(eq(donations.countryId, params.countryId));
    }
    if (params.categoryId) {
      conditions.push(eq(donations.categoryId, params.categoryId));
    }
    if (params.governorateId) {
      conditions.push(eq(donations.governorateId, params.governorateId));
    }
    if (params.search) {
      conditions.push(
        or(
          ilike(donations.medicineNameEn, `%${params.search}%`),
          ilike(donations.medicineNameAr, `%${params.search}%`)
        )!
      );
    }

    const results = await db
      .select({
        donation: donations,
        category: medicineCategories,
        donorFirstName: users.firstName,
        donorLastName: users.lastName,
        governorateName: governorates.nameEn,
        governorateNameAr: governorates.nameAr,
        countryName: countries.nameEn,
        countryNameAr: countries.nameAr,
      })
      .from(donations)
      .leftJoin(medicineCategories, eq(donations.categoryId, medicineCategories.id))
      .leftJoin(users, eq(donations.donorId, users.id))
      .leftJoin(governorates, eq(donations.governorateId, governorates.id))
      .leftJoin(countries, eq(donations.countryId, countries.id))
      .where(and(...conditions))
      .orderBy(desc(donations.createdAt));

    return results;
  }

  async updateDonationQuantities(id: number, quantities: any[]): Promise<void> {
    const allZero = quantities.every((q: any) => q.remaining <= 0);
    await db.update(donations).set({
      quantities,
      status: allZero ? "completed" : "active",
    }).where(eq(donations.id, id));
  }

  async updateDonationStatus(id: number, status: string): Promise<void> {
    await db.update(donations).set({ status }).where(eq(donations.id, id));
  }

  async createRequest(req: InsertRequest): Promise<Request> {
    const [result] = await db.insert(requests).values(req).returning();
    return result;
  }

  async getRequest(id: number): Promise<any> {
    const [result] = await db
      .select({
        request: requests,
        donation: donations,
        requesterFirstName: users.firstName,
        requesterLastName: users.lastName,
      })
      .from(requests)
      .leftJoin(donations, eq(requests.donationId, donations.id))
      .leftJoin(users, eq(requests.requesterId, users.id))
      .where(eq(requests.id, id));
    return result;
  }

  async getRequestsByDonation(donationId: number): Promise<any[]> {
    return db
      .select({
        request: requests,
        requesterFirstName: users.firstName,
        requesterLastName: users.lastName,
      })
      .from(requests)
      .leftJoin(users, eq(requests.requesterId, users.id))
      .where(eq(requests.donationId, donationId))
      .orderBy(desc(requests.createdAt));
  }

  async getRequestsByRequester(requesterId: string): Promise<any[]> {
    return db
      .select({
        request: requests,
        donation: donations,
        donorFirstName: users.firstName,
        donorLastName: users.lastName,
      })
      .from(requests)
      .leftJoin(donations, eq(requests.donationId, donations.id))
      .leftJoin(users, eq(donations.donorId, users.id))
      .where(eq(requests.requesterId, requesterId))
      .orderBy(desc(requests.createdAt));
  }

  async updateRequestStatus(id: number, status: string, deliveryDate?: string, deliveryTime?: string): Promise<void> {
    const updateData: any = { status };
    if (deliveryDate) updateData.proposedDeliveryDate = deliveryDate;
    if (deliveryTime) updateData.proposedDeliveryTime = deliveryTime;
    await db.update(requests).set(updateData).where(eq(requests.id, id));
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const [result] = await db.insert(messages).values(msg).returning();
    return result;
  }

  async getMessagesByRequest(requestId: number): Promise<any[]> {
    return db
      .select({
        message: messages,
        senderFirstName: users.firstName,
        senderLastName: users.lastName,
        senderProfileImage: users.profileImageUrl,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.requestId, requestId))
      .orderBy(asc(messages.createdAt));
  }

  async createDeliveryConfirmation(conf: InsertDeliveryConfirmation): Promise<DeliveryConfirmation> {
    const [result] = await db.insert(deliveryConfirmations).values(conf).returning();
    return result;
  }

  async getDeliveryConfirmation(requestId: number): Promise<DeliveryConfirmation | undefined> {
    const [result] = await db.select().from(deliveryConfirmations).where(eq(deliveryConfirmations.requestId, requestId));
    return result;
  }

  async updateDeliveryConfirmation(id: number, data: Partial<DeliveryConfirmation>): Promise<void> {
    await db.update(deliveryConfirmations).set(data).where(eq(deliveryConfirmations.id, id));
  }

  async createAdminFlag(flag: InsertAdminFlag): Promise<AdminFlag> {
    const [result] = await db.insert(adminFlags).values(flag).returning();
    return result;
  }

  async getAdminFlags(): Promise<any[]> {
    return db
      .select({
        flag: adminFlags,
        flaggedUserFirstName: users.firstName,
        flaggedUserLastName: users.lastName,
      })
      .from(adminFlags)
      .leftJoin(users, eq(adminFlags.flaggedUserId, users.id))
      .orderBy(desc(adminFlags.createdAt));
  }

  async markFlagReviewed(id: number, reviewedBy: string): Promise<void> {
    await db.update(adminFlags).set({ reviewed: true, reviewedBy }).where(eq(adminFlags.id, id));
  }

  async getActiveDonationsCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(donations)
      .where(and(eq(donations.donorId, userId), eq(donations.status, "active")));
    return Number(result[0]?.count || 0);
  }

  async getDashboardStats(userId: string): Promise<any> {
    const activeDonations = await db
      .select({ count: sql<number>`count(*)` })
      .from(donations)
      .where(and(eq(donations.donorId, userId), eq(donations.status, "active")));

    const pendingRequests = await db
      .select({ count: sql<number>`count(*)` })
      .from(requests)
      .where(and(eq(requests.requesterId, userId), eq(requests.status, "pending")));

    const totalDonated = await db
      .select({ count: sql<number>`count(*)` })
      .from(donations)
      .where(eq(donations.donorId, userId));

    const incomingPending = await db
      .select({ count: sql<number>`count(*)` })
      .from(requests)
      .innerJoin(donations, eq(requests.donationId, donations.id))
      .where(and(eq(donations.donorId, userId), eq(requests.status, "pending")));

    return {
      activeDonations: Number(activeDonations[0]?.count || 0),
      pendingRequests: Number(pendingRequests[0]?.count || 0),
      totalDonated: Number(totalDonated[0]?.count || 0),
      incomingPendingRequests: Number(incomingPending[0]?.count || 0),
    };
  }

  async seedInitialData(): Promise<void> {
    const existingCategories = await db.select().from(medicineCategories).limit(1);
    if (existingCategories.length === 0) {
      await db.insert(medicineCategories).values([
        { nameEn: "Pain Relief", nameAr: "مسكنات الألم" },
        { nameEn: "Antibiotics", nameAr: "المضادات الحيوية" },
        { nameEn: "Vitamins & Supplements", nameAr: "الفيتامينات والمكملات" },
        { nameEn: "Allergy & Cold", nameAr: "الحساسية والبرد" },
        { nameEn: "Digestive Health", nameAr: "صحة الجهاز الهضمي" },
        { nameEn: "Cardiovascular", nameAr: "أمراض القلب والأوعية" },
        { nameEn: "Diabetes", nameAr: "السكري" },
        { nameEn: "Skin Care", nameAr: "العناية بالبشرة" },
        { nameEn: "Eye & Ear", nameAr: "العين والأذن" },
        { nameEn: "Other", nameAr: "أخرى" },
      ]);
    }

    const existingCountries = await db.select().from(countries).limit(1);
    if (existingCountries.length > 0) return;

    for (const countryData of seedCountries) {
      const [country] = await db.insert(countries).values({
        nameEn: countryData.nameEn,
        nameAr: countryData.nameAr,
      }).returning();

      const govsList = seedGovernorates[countryData.nameEn] || [];
      for (const govData of govsList) {
        const [gov] = await db.insert(governorates).values({
          countryId: country.id,
          nameEn: govData.nameEn,
          nameAr: govData.nameAr,
        }).returning();

        if (govData.areas.length > 0) {
          await db.insert(areas).values(
            govData.areas.map(a => ({
              governorateId: gov.id,
              nameEn: a.nameEn,
              nameAr: a.nameAr,
            }))
          );
        }
      }
    }
  }
}

export const storage = new DatabaseStorage();
