import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { userProfiles } from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq, sql } from "drizzle-orm";

const MAX_ACTIVE_DONATIONS = 10;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  await storage.seedInitialData();

  app.get("/api/countries", async (_req, res) => {
    const data = await storage.getCountries();
    res.json(data);
  });

  app.get("/api/governorates/:countryId", async (req, res) => {
    const data = await storage.getGovernoratesByCountry(Number(req.params.countryId));
    res.json(data);
  });

  app.get("/api/areas/:governorateId", async (req, res) => {
    const data = await storage.getAreasByGovernorate(Number(req.params.governorateId));
    res.json(data);
  });

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);
    res.json(profile || null);
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const { countryId, governorateId, areaId, declarationAccepted } = req.body;

    if (!declarationAccepted) {
      return res.status(400).json({ message: "You must accept the charitable use declaration" });
    }
    if (!countryId) {
      return res.status(400).json({ message: "Country is required" });
    }

    const profile = await storage.upsertUserProfile({
      userId,
      countryId,
      governorateId: governorateId || null,
      areaId: areaId || null,
      declarationAccepted,
    });
    res.json(profile);
  });

  app.get("/api/categories", async (_req, res) => {
    const data = await storage.getCategories();
    res.json(data);
  });

  app.post("/api/categories", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);
    if (!profile?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { nameEn, nameAr } = req.body;
    if (!nameEn || !nameAr) {
      return res.status(400).json({ message: "Both English and Arabic names are required" });
    }
    const cat = await storage.createCategory({ nameEn, nameAr });
    res.json(cat);
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);
    if (!profile?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    await storage.deleteCategory(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/medicines/search", isAuthenticated, async (req: any, res) => {
    const query = (req.query.q as string || "").trim().toLowerCase();
    if (query.length < 2) return res.json([]);

    try {
      const url = `https://api.fda.gov/drug/label.json?search=(openfda.brand_name:${encodeURIComponent(query)}*)+OR+(openfda.generic_name:${encodeURIComponent(query)}*)&limit=10`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.json([]);
      }
      const data = await response.json();
      const names = new Set<string>();
      for (const result of data.results || []) {
        const brandNames = result.openfda?.brand_name || [];
        const genericNames = result.openfda?.generic_name || [];
        for (const name of [...brandNames, ...genericNames]) {
          if (name.toLowerCase().includes(query)) {
            names.add(name);
          }
        }
      }
      res.json([...names].slice(0, 15));
    } catch {
      res.json([]);
    }
  });

  app.post("/api/donations", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);
    if (!profile) {
      return res.status(400).json({ message: "Please complete your profile first" });
    }
    if (!profile.declarationAccepted) {
      return res.status(400).json({ message: "You must accept the charitable use declaration" });
    }

    const activeCount = await storage.getActiveDonationsCount(userId);
    if (activeCount >= MAX_ACTIVE_DONATIONS) {
      return res.status(400).json({ message: `Maximum ${MAX_ACTIVE_DONATIONS} active donations allowed` });
    }

    const { medicineNameEn, medicineNameAr, categoryId, expiryDate, quantities, locationDescription, locationCoords, notes } = req.body;

    const expiry = new Date(expiryDate);
    if (expiry <= new Date()) {
      return res.status(400).json({ message: "Cannot donate expired medicines" });
    }

    if (!quantities || quantities.length === 0) {
      return res.status(400).json({ message: "At least one quantity entry is required" });
    }

    const quantitiesWithRemaining = quantities.map((q: any) => ({
      unit: q.unit,
      quantity: q.quantity,
      remaining: q.quantity,
    }));

    const donation = await storage.createDonation({
      donorId: userId,
      medicineNameEn,
      medicineNameAr,
      categoryId: categoryId || null,
      expiryDate,
      quantities: quantitiesWithRemaining,
      locationDescription: locationDescription || null,
      locationCoords: locationCoords || null,
      notes: notes || null,
      status: "active",
      countryId: profile.countryId,
      governorateId: profile.governorateId,
      areaId: profile.areaId,
    });

    if (medicineNameEn && medicineNameEn.length >= 2) {
      try {
        const normalized = medicineNameEn.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
        const fdaUrl = `https://api.fda.gov/drug/label.json?search=(openfda.brand_name:${encodeURIComponent(normalized)}*)+OR+(openfda.generic_name:${encodeURIComponent(normalized)}*)&limit=5`;
        const fdaRes = await fetch(fdaUrl);
        if (fdaRes.ok) {
          const fdaData = await fdaRes.json();
          const allNames: string[] = [];
          for (const r of fdaData.results || []) {
            allNames.push(...(r.openfda?.brand_name || []), ...(r.openfda?.generic_name || []));
          }
          const isRecognized = allNames.some(n => n.toLowerCase().includes(normalized) || normalized.includes(n.toLowerCase()));
          if (!isRecognized) {
            await storage.createAdminFlag({
              flaggedUserId: userId,
              reason: `Unrecognized medicine name: "${medicineNameEn}"`,
              relatedDonationId: donation.id,
              relatedRequestId: null,
              reviewed: false,
              reviewedBy: null,
            });
          }
        }
      } catch {}
    }

    res.json(donation);
  });

  app.get("/api/donations/search", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);

    const { search, categoryId, governorateId } = req.query;
    const results = await storage.searchDonations({
      search: search as string,
      categoryId: categoryId ? Number(categoryId) : undefined,
      governorateId: governorateId ? Number(governorateId) : undefined,
      countryId: profile?.countryId || undefined,
    });
    res.json(results);
  });

  app.get("/api/donations/mine", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const data = await storage.getDonationsByDonor(userId);
    res.json(data);
  });

  app.get("/api/donations/mine/pending-counts", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const counts = await storage.getPendingRequestCountsByDonor(userId);
    res.json(counts);
  });

  app.get("/api/donations/:id", isAuthenticated, async (req: any, res) => {
    const donation = await storage.getDonation(Number(req.params.id));
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    res.json(donation);
  });

  app.get("/api/donations/:id/requests", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const donation = await storage.getDonation(Number(req.params.id));
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    const profile = await storage.getUserProfile(userId);
    if (donation.donorId !== userId && !profile?.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    const data = await storage.getRequestsByDonation(Number(req.params.id));
    res.json(data);
  });

  app.patch("/api/donations/:id", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const donation = await storage.getDonation(Number(req.params.id));
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    if (donation.donorId !== userId) return res.status(403).json({ message: "Access denied" });
    if (donation.status !== "active") return res.status(400).json({ message: "Can only edit active donations" });

    const { medicineNameEn, medicineNameAr, quantities, notes, locationDescription, locationCoords } = req.body;
    const updateData: any = {};
    if (medicineNameEn !== undefined) updateData.medicineNameEn = medicineNameEn;
    if (medicineNameAr !== undefined) updateData.medicineNameAr = medicineNameAr;
    if (notes !== undefined) updateData.notes = notes;
    if (locationDescription !== undefined) updateData.locationDescription = locationDescription;
    if (locationCoords !== undefined) updateData.locationCoords = locationCoords;
    if (quantities !== undefined) updateData.quantities = quantities;

    const updated = await storage.updateDonation(donation.id, updateData);
    res.json(updated);
  });

  app.delete("/api/donations/:id", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const donation = await storage.getDonation(Number(req.params.id));
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    if (donation.donorId !== userId) return res.status(403).json({ message: "Access denied" });

    const existingRequests = await storage.getRequestsByDonation(donation.id);
    const hasActiveRequests = existingRequests.some((r: any) =>
      r.request.status === "pending" || r.request.status === "approved"
    );
    if (hasActiveRequests) {
      return res.status(400).json({ message: "Cannot delete donation with active requests" });
    }

    await storage.deleteDonation(donation.id);
    await db
      .update(userProfiles)
      .set({ activeDonationsCount: sql`GREATEST(${userProfiles.activeDonationsCount} - 1, 0)` })
      .where(eq(userProfiles.userId, userId));
    res.json({ success: true });
  });

  app.post("/api/requests", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);
    if (!profile) {
      return res.status(400).json({ message: "Please complete your profile first" });
    }

    const { donationId, requestedQuantities } = req.body;
    const donation = await storage.getDonation(donationId);
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    if (donation.donorId === userId) return res.status(400).json({ message: "Cannot request your own donation" });
    if (donation.status !== "active") return res.status(400).json({ message: "Donation is no longer active" });

    const alreadyRequested = await storage.hasExistingRequest(donationId, userId);
    if (alreadyRequested) return res.status(400).json({ message: "You have already requested this medicine" });

    const request = await storage.createRequest({
      donationId,
      requesterId: userId,
      requestedQuantities,
      status: "pending",
    });

    await storage.createNotification({
      userId: donation.donorId,
      type: "new_request",
      titleEn: `New request for "${donation.medicineNameEn}"`,
      titleAr: `طلب جديد على "${donation.medicineNameAr}"`,
      relatedRequestId: request.id,
      relatedDonationId: donationId,
      isRead: false,
    });

    res.json(request);
  });

  app.get("/api/requests/mine", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const data = await storage.getRequestsByRequester(userId);
    res.json(data);
  });

  app.get("/api/requests/:id", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const data = await storage.getRequest(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Request not found" });
    if (data.request.requesterId !== userId && data.donation?.donorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(data);
  });

  app.patch("/api/requests/:id/status", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const requestId = Number(req.params.id);
    const { status, deliveryDate, deliveryTime } = req.body;
    const requestData = await storage.getRequest(requestId);
    if (!requestData) return res.status(404).json({ message: "Request not found" });

    if (requestData.donation.donorId !== userId) {
      return res.status(403).json({ message: "Only the donor can approve/reject requests" });
    }

    await storage.updateRequestStatus(requestId, status, deliveryDate, deliveryTime);

    if (status === "approved") {
      await storage.createDeliveryConfirmation({
        requestId,
        matchStatus: "pending",
      });
    }

    const medicineName = requestData.donation?.medicineNameEn || "";
    const medicineNameAr = requestData.donation?.medicineNameAr || "";
    const statusLabels: Record<string, { en: string; ar: string }> = {
      approved: { en: "approved", ar: "تمت الموافقة على" },
      rejected: { en: "rejected", ar: "تم رفض" },
    };
    const label = statusLabels[status];
    if (label) {
      await storage.createNotification({
        userId: requestData.request.requesterId,
        type: "request_status",
        titleEn: `Your request for "${medicineName}" has been ${label.en}`,
        titleAr: `${label.ar} طلبك على "${medicineNameAr}"`,
        relatedRequestId: requestId,
        relatedDonationId: requestData.donation?.id,
        isRead: false,
      });
    }

    res.json({ success: true });
  });

  app.get("/api/requests/:id/messages", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const reqData = await storage.getRequest(Number(req.params.id));
    if (!reqData) return res.status(404).json({ message: "Request not found" });
    if (reqData.request.requesterId !== userId && reqData.donation?.donorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const data = await storage.getMessagesByRequest(Number(req.params.id));
    res.json(data);
  });

  app.post("/api/requests/:id/messages", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Message content is required" });
    const reqData = await storage.getRequest(Number(req.params.id));
    if (!reqData) return res.status(404).json({ message: "Request not found" });
    if (reqData.request.requesterId !== userId && reqData.donation?.donorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const requestId = Number(req.params.id);
    const msg = await storage.createMessage({
      requestId,
      senderId: userId,
      content: content.trim(),
    });

    const requestData = await storage.getRequest(requestId);
    if (requestData) {
      const recipientId = requestData.donation?.donorId === userId
        ? requestData.request.requesterId
        : requestData.donation?.donorId;
      if (recipientId) {
        await storage.createNotification({
          userId: recipientId,
          type: "new_message",
          titleEn: `New message about "${requestData.donation?.medicineNameEn || ""}"`,
          titleAr: `رسالة جديدة بخصوص "${requestData.donation?.medicineNameAr || ""}"`,
          relatedRequestId: requestId,
          relatedDonationId: requestData.donation?.id,
          isRead: false,
        });
      }
    }

    res.json(msg);
  });

  app.get("/api/delivery/:requestId", isAuthenticated, async (req: any, res) => {
    const conf = await storage.getDeliveryConfirmation(Number(req.params.requestId));
    res.json(conf || null);
  });

  app.post("/api/delivery/:requestId/confirm", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const requestId = Number(req.params.requestId);
    const { quantities, role } = req.body;

    let conf = await storage.getDeliveryConfirmation(requestId);
    if (!conf) {
      return res.status(404).json({ message: "No delivery confirmation found" });
    }

    const updateData: any = {};
    if (role === "donor") {
      updateData.donorQuantities = quantities;
      updateData.donorConfirmedAt = new Date();
    } else {
      updateData.recipientQuantities = quantities;
      updateData.recipientConfirmedAt = new Date();
    }

    await storage.updateDeliveryConfirmation(conf.id, updateData);

    conf = await storage.getDeliveryConfirmation(requestId);
    if (conf && conf.donorConfirmedAt && conf.recipientConfirmedAt) {
      const donorQ = JSON.stringify(conf.donorQuantities);
      const recipientQ = JSON.stringify(conf.recipientQuantities);

      if (donorQ === recipientQ) {
        await storage.updateDeliveryConfirmation(conf.id, { matchStatus: "matched" });
        await storage.updateRequestStatus(requestId, "delivered");

        const requestData = await storage.getRequest(requestId);
        if (requestData?.donation) {
          const donation = await storage.getDonation(requestData.donation.id);
          if (donation) {
            const updatedQuantities = (donation.quantities as any[]).map((q: any) => {
              const confirmed = (conf!.donorQuantities as any[])?.find((cq: any) => cq.unit === q.unit);
              if (confirmed) {
                return { ...q, remaining: Math.max(0, q.remaining - confirmed.quantity) };
              }
              return q;
            });
            await storage.updateDonationQuantities(donation.id, updatedQuantities);
          }
        }
      } else {
        await storage.updateDeliveryConfirmation(conf.id, { matchStatus: "mismatched" });
        const requestData = await storage.getRequest(requestId);
        await storage.createAdminFlag({
          flaggedUserId: null,
          reason: "Delivery quantity mismatch between donor and recipient",
          relatedRequestId: requestId,
          relatedDonationId: requestData?.donation?.id || null,
          reviewed: false,
        });
      }
    }

    res.json({ success: true });
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const data = await storage.getNotificationsByUser(userId);
    res.json(data);
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    await storage.markNotificationRead(Number(req.params.id), userId);
    res.json({ success: true });
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  });

  app.get("/api/stats/public", async (_req, res) => {
    const stats = await storage.getPublicStats();
    res.json(stats);
  });

  app.patch("/api/auth/user", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const { firstName, lastName, profileImageUrl } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    res.json(updated);
  });

  app.get("/api/dashboard", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const stats = await storage.getDashboardStats(userId);
    res.json(stats);
  });

  app.get("/api/admin/flags", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);
    if (!profile?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    const data = await storage.getAdminFlags();
    res.json(data);
  });

  app.patch("/api/admin/flags/:id", isAuthenticated, async (req: any, res) => {
    const userId = (req.user as any).id;
    const profile = await storage.getUserProfile(userId);
    if (!profile?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    await storage.markFlagReviewed(Number(req.params.id), userId);
    res.json({ success: true });
  });

  return httpServer;
}
