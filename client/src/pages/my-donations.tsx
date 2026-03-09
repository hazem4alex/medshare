import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Calendar, AlertTriangle, Check, X, Clock, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Link } from "wouter";
import type { Donation } from "@shared/schema";

function isNearExpiry(expiryDate: string): boolean {
  const exp = new Date(expiryDate);
  const now = new Date();
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 30 && diffDays > 0;
}

export default function MyDonationsPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  const [selectedDonationId, setSelectedDonationId] = useState<number | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [approveRequestId, setApproveRequestId] = useState<number | null>(null);
  const [editDonation, setEditDonation] = useState<Donation | null>(null);
  const [editForm, setEditForm] = useState({ medicineNameEn: "", medicineNameAr: "", notes: "", locationDescription: "" });

  const { data: myDonations, isLoading } = useQuery<Donation[]>({
    queryKey: ["/api/donations/mine"],
  });

  const { data: pendingCounts } = useQuery<Record<number, number>>({
    queryKey: ["/api/donations/mine/pending-counts"],
    staleTime: 0,
  });

  const { data: donationRequests } = useQuery<any[]>({
    queryKey: ["/api/donations", selectedDonationId, "requests"],
    enabled: !!selectedDonationId,
    staleTime: 0,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: number; status: string }) => {
      await apiRequest("PATCH", `/api/requests/${requestId}/status`, {
        status,
        deliveryDate: deliveryDate || undefined,
        deliveryTime: deliveryTime || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/donations/mine/pending-counts"] });
      setApproveRequestId(null);
      setDeliveryDate("");
      setDeliveryTime("");
      toast({ title: t("myDonations.requestUpdated") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editDonation) return;
      await apiRequest("PATCH", `/api/donations/${editDonation.id}`, editForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
      setEditDonation(null);
      toast({ title: t("myDonations.editSuccess") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/donations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: t("myDonations.deleteSuccess") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const openEditDialog = (d: Donation) => {
    setEditDonation(d);
    setEditForm({
      medicineNameEn: d.medicineNameEn,
      medicineNameAr: d.medicineNameAr,
      notes: d.notes || "",
      locationDescription: d.locationDescription || "",
    });
  };

  const unitLabel = (unit: string) => {
    const map: Record<string, string> = { box: t("units.box"), strip: t("units.strip"), pill: t("units.pill") };
    return map[unit] || unit;
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      delivered: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{t(`request.${status}`)}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-my-donations-title">
          <Package className="h-6 w-6 text-primary" />
          {t("myDonations.title")}
        </h1>
        <p className="text-muted-foreground">{t("myDonations.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !myDonations?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-donations">{t("myDonations.noDonations")}</p>
            <Link href="/donate">
              <Button className="mt-4">{t("nav.donate")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myDonations.map((d) => {
            const nearExpiry = isNearExpiry(d.expiryDate);
            const isExpired = new Date(d.expiryDate) <= new Date();

            return (
              <Card key={d.id} data-testid={`card-my-donation-${d.id}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold">
                        {isAr ? d.medicineNameAr || d.medicineNameEn : d.medicineNameEn}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isAr ? d.medicineNameEn : d.medicineNameAr}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {nearExpiry && (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 me-1" />
                          {t("browse.nearExpiry")}
                        </Badge>
                      )}
                      {isExpired && <Badge variant="destructive">{t("myDonations.expired")}</Badge>}
                      <Badge variant={d.status === "active" ? "default" : "secondary"}>
                        {d.status === "active" ? t("myDonations.active") : d.status === "completed" ? t("myDonations.completed") : d.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("browse.expiresOn")}: {new Date(d.expiryDate).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(d.quantities as any[]).map((q: any, i: number) => (
                      <Badge key={i} variant="outline">
                        {q.remaining}/{q.quantity} {unitLabel(q.unit)}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedDonationId(selectedDonationId === d.id ? null : d.id)}
                      data-testid={`button-view-requests-${d.id}`}
                    >
                      <MessageCircle className="h-3.5 w-3.5 me-1" />
                      {t("myDonations.incomingRequests")}
                      {(pendingCounts?.[d.id] ?? 0) > 0 && (
                        <Badge variant="destructive" className="ms-2 h-5 min-w-5 px-1 text-xs">
                          {pendingCounts[d.id]}
                        </Badge>
                      )}
                    </Button>

                    {d.status === "active" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(d)}
                          data-testid={`button-edit-donation-${d.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5 me-1" />
                          {t("myDonations.edit")}
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              data-testid={`button-delete-donation-${d.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 me-1" />
                              {t("myDonations.deleteDonation")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("myDonations.confirmDelete")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("myDonations.confirmDeleteDesc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(d.id)}
                                data-testid={`button-confirm-delete-${d.id}`}
                              >
                                {t("common.delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>

                  {selectedDonationId === d.id && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      <h4 className="text-sm font-semibold">{t("myDonations.incomingRequests")}</h4>
                      {!donationRequests?.length ? (
                        <p className="text-sm text-muted-foreground">{t("myDonations.noRequests")}</p>
                      ) : (
                        donationRequests.map((r: any) => (
                          <div key={r.request.id} className="bg-muted/30 rounded-md p-3 space-y-2" data-testid={`card-request-${r.request.id}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={r.requesterProfileImage || ""} />
                                  <AvatarFallback className="text-xs">
                                    {(r.requesterFirstName?.[0] || "").toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">
                                  {r.requesterFirstName} {r.requesterLastName}
                                </span>
                              </div>
                              {statusBadge(r.request.status)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(r.request.requestedQuantities as any[]).map((q: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {q.quantity} {unitLabel(q.unit)}
                                </Badge>
                              ))}
                            </div>
                            {r.request.status === "pending" && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  size="sm"
                                  onClick={() => setApproveRequestId(r.request.id)}
                                  data-testid={`button-approve-${r.request.id}`}
                                >
                                  <Check className="h-3 w-3 me-1" />
                                  {t("myDonations.approve")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => statusMutation.mutate({ requestId: r.request.id, status: "rejected" })}
                                  data-testid={`button-reject-${r.request.id}`}
                                >
                                  <X className="h-3 w-3 me-1" />
                                  {t("myDonations.reject")}
                                </Button>
                              </div>
                            )}
                            {r.request.status === "approved" && (
                              <Link href={`/requests/${r.request.id}`}>
                                <Button size="sm" variant="secondary" data-testid={`button-view-request-${r.request.id}`}>
                                  {t("myRequests.viewDetails")}
                                </Button>
                              </Link>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!approveRequestId} onOpenChange={() => setApproveRequestId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("myDonations.proposeDelivery")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("myDonations.deliveryDate")}</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                data-testid="input-delivery-date"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("myDonations.deliveryTime")}</Label>
              <Input
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                data-testid="input-delivery-time"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setApproveRequestId(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (approveRequestId) {
                  statusMutation.mutate({ requestId: approveRequestId, status: "approved" });
                }
              }}
              disabled={statusMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {t("myDonations.approve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editDonation} onOpenChange={() => setEditDonation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("myDonations.editDonation")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("donate.medicineNameEn")}</Label>
              <Input
                value={editForm.medicineNameEn}
                onChange={(e) => setEditForm({ ...editForm, medicineNameEn: e.target.value })}
                data-testid="input-edit-name-en"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("donate.medicineNameAr")}</Label>
              <Input
                value={editForm.medicineNameAr}
                onChange={(e) => setEditForm({ ...editForm, medicineNameAr: e.target.value })}
                data-testid="input-edit-name-ar"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("donate.locationDescription")}</Label>
              <Input
                value={editForm.locationDescription}
                onChange={(e) => setEditForm({ ...editForm, locationDescription: e.target.value })}
                data-testid="input-edit-location"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("donate.notes")}</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditDonation(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              data-testid="button-save-edit"
            >
              {editMutation.isPending ? t("profile.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
