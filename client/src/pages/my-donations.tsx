import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Calendar, AlertTriangle, Check, X, Clock, MessageCircle } from "lucide-react";
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

  const { data: myDonations, isLoading } = useQuery<Donation[]>({
    queryKey: ["/api/donations/mine"],
  });

  const { data: donationRequests } = useQuery<any[]>({
    queryKey: ["/api/donations", selectedDonationId, "requests"],
    enabled: !!selectedDonationId,
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
      setApproveRequestId(null);
      setDeliveryDate("");
      setDeliveryTime("");
      toast({ title: "Request updated" });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

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
                      {isExpired && <Badge variant="destructive">Expired</Badge>}
                      <Badge variant={d.status === "active" ? "default" : "secondary"}>
                        {d.status}
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

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedDonationId(selectedDonationId === d.id ? null : d.id)}
                    data-testid={`button-view-requests-${d.id}`}
                  >
                    <MessageCircle className="h-3.5 w-3.5 me-1" />
                    {t("myDonations.incomingRequests")}
                  </Button>

                  {selectedDonationId === d.id && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      <h4 className="text-sm font-semibold">{t("myDonations.incomingRequests")}</h4>
                      {!donationRequests?.length ? (
                        <p className="text-sm text-muted-foreground">{t("myDonations.noRequests")}</p>
                      ) : (
                        donationRequests.map((r: any) => (
                          <div key={r.request.id} className="bg-muted/30 rounded-md p-3 space-y-2" data-testid={`card-request-${r.request.id}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-sm font-medium">
                                {r.requesterFirstName} {r.requesterLastName}
                              </span>
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
    </div>
  );
}
