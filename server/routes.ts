import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

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
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    res.json(profile || null);
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    if (!profile?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    await storage.deleteCategory(Number(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/donations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
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
    res.json(donation);
  });

  app.get("/api/donations/search", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
    const data = await storage.getDonationsByDonor(userId);
    res.json(data);
  });

  app.get("/api/donations/:id", isAuthenticated, async (req: any, res) => {
    const donation = await storage.getDonation(Number(req.params.id));
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    res.json(donation);
  });

  app.get("/api/donations/:id/requests", isAuthenticated, async (req: any, res) => {
    const data = await storage.getRequestsByDonation(Number(req.params.id));
    res.json(data);
  });

  app.post("/api/requests", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    if (!profile) {
      return res.status(400).json({ message: "Please complete your profile first" });
    }

    const { donationId, requestedQuantities } = req.body;
    const donation = await storage.getDonation(donationId);
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    if (donation.donorId === userId) return res.status(400).json({ message: "Cannot request your own donation" });
    if (donation.status !== "active") return res.status(400).json({ message: "Donation is no longer active" });

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
    const userId = req.user.claims.sub;
    const data = await storage.getRequestsByRequester(userId);
    res.json(data);
  });

  app.get("/api/requests/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const data = await storage.getRequest(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Request not found" });
    if (data.request.requesterId !== userId && data.donation?.donorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(data);
  });

  app.patch("/api/requests/:id/status", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
    const reqData = await storage.getRequest(Number(req.params.id));
    if (!reqData) return res.status(404).json({ message: "Request not found" });
    if (reqData.request.requesterId !== userId && reqData.donation?.donorId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const data = await storage.getMessagesByRequest(Number(req.params.id));
    res.json(data);
  });

  app.post("/api/requests/:id/messages", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
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
    const userId = req.user.claims.sub;
    const data = await storage.getNotificationsByUser(userId);
    res.json(data);
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.markNotificationRead(Number(req.params.id), userId);
    res.json({ success: true });
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  });

  app.get("/api/dashboard", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const stats = await storage.getDashboardStats(userId);
    res.json(stats);
  });

  app.get("/api/admin/flags", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    if (!profile?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    const data = await storage.getAdminFlags();
    res.json(data);
  });

  app.patch("/api/admin/flags/:id", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const profile = await storage.getUserProfile(userId);
    if (!profile?.isAdmin) return res.status(403).json({ message: "Admin access required" });
    await storage.markFlagReviewed(Number(req.params.id), userId);
    res.json({ success: true });
  });

  return httpServer;
}
