import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useParams } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Check, AlertTriangle, Calendar, Clock, Flag } from "lucide-react";
import type { DeliveryConfirmation } from "@shared/schema";
import { ReportDialog } from "@/components/report-dialog";

export default function RequestDetailPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const requestId = Number(params.id);
  const isAr = i18n.language === "ar";

  const [messageContent, setMessageContent] = useState("");
  const [confirmQuantities, setConfirmQuantities] = useState<Array<{ unit: string; quantity: number }>>([]);
  const [reportOpen, setReportOpen] = useState(false);

  const { data: requestData, isLoading } = useQuery<any>({
    queryKey: ["/api/requests", requestId],
  });

  const { data: messagesData } = useQuery<any[]>({
    queryKey: ["/api/requests", requestId, "messages"],
    refetchInterval: 5000,
  });

  const { data: deliveryConf } = useQuery<DeliveryConfirmation | null>({
    queryKey: ["/api/delivery", requestId],
    enabled: requestData?.request?.status === "approved" || requestData?.request?.status === "delivered",
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/requests/${requestId}/messages`, { content: messageContent });
    },
    onSuccess: () => {
      setMessageContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId, "messages"] });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const confirmDeliveryMutation = useMutation({
    mutationFn: async () => {
      const isDonor = requestData?.donation?.donorId === user?.id;
      await apiRequest("POST", `/api/delivery/${requestId}/confirm`, {
        quantities: confirmQuantities,
        role: isDonor ? "donor" : "recipient",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery", requestId] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests", requestId] });
      toast({ title: t("delivery.confirmed") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const unitLabel = (unit: string) => {
    const map: Record<string, string> = { box: t("units.box"), strip: t("units.strip"), pill: t("units.pill") };
    return map[unit] || unit;
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!requestData) return null;

  const req = requestData.request;
  const donation = requestData.donation;
  const isDonor = donation?.donorId === user?.id;
  const isRecipient = req.requesterId === user?.id;

  const initConfirmQuantities = () => {
    if (confirmQuantities.length === 0) {
      const qtys = (req.requestedQuantities as any[]).map((q: any) => ({
        unit: q.unit,
        quantity: q.quantity,
      }));
      setConfirmQuantities(qtys);
    }
  };

  const donorConfirmed = !!deliveryConf?.donorConfirmedAt;
  const recipientConfirmed = !!deliveryConf?.recipientConfirmedAt;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-serif font-bold" data-testid="text-request-detail-title">
            {donation && (isAr ? donation.medicineNameAr || donation.medicineNameEn : donation.medicineNameEn)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("browse.donatedBy")}: {requestData.requesterFirstName} {requestData.requesterLastName}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => setReportOpen(true)}
          data-testid="button-report-request"
        >
          <Flag className="h-4 w-4 me-1" />
          {t("report.title")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {(req.requestedQuantities as any[]).map((q: any, i: number) => (
                <Badge key={i} variant="outline">
                  {q.quantity} {unitLabel(q.unit)}
                </Badge>
              ))}
            </div>
            <Badge variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}>
              {t(`request.${req.status}`)}
            </Badge>
          </div>

          {req.proposedDeliveryDate && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(req.proposedDeliveryDate).toLocaleDateString()}
              </div>
              {req.proposedDeliveryTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {req.proposedDeliveryTime}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {req.status === "approved" && deliveryConf && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              {t("delivery.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {deliveryConf.matchStatus === "matched" && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                <Check className="h-4 w-4" />
                {t("delivery.matched")}
              </div>
            )}
            {deliveryConf.matchStatus === "mismatched" && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t("delivery.mismatched")}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("delivery.confirmAsdonor")}</p>
                <p className="text-xs text-muted-foreground">
                  {donorConfirmed ? t("delivery.confirmed") : t("delivery.pending")}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("delivery.confirmAsRecipient")}</p>
                <p className="text-xs text-muted-foreground">
                  {recipientConfirmed ? t("delivery.confirmed") : t("delivery.pending")}
                </p>
              </div>
            </div>

            {((isDonor && !donorConfirmed) || (isRecipient && !recipientConfirmed)) && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-sm font-medium">{t("delivery.quantityDelivered")}</p>
                {(() => {
                  initConfirmQuantities();
                  return confirmQuantities.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <Label className="w-20">{unitLabel(q.unit)}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={q.quantity}
                        onChange={(e) => {
                          const updated = [...confirmQuantities];
                          updated[idx].quantity = Number(e.target.value);
                          setConfirmQuantities(updated);
                        }}
                        className="w-24"
                        data-testid={`input-confirm-qty-${idx}`}
                      />
                    </div>
                  ));
                })()}
                <Button
                  onClick={() => confirmDeliveryMutation.mutate()}
                  disabled={confirmDeliveryMutation.isPending}
                  data-testid="button-confirm-delivery"
                >
                  <Check className="h-4 w-4 me-1" />
                  {t("common.confirm")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("messages.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-80 overflow-y-auto space-y-3">
            {!messagesData?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-messages">
                {t("messages.noMessages")}
              </p>
            ) : (
              messagesData.map((m: any) => {
                const isMe = m.message.senderId === user?.id;
                return (
                  <div
                    key={m.message.id}
                    className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                    data-testid={`message-${m.message.id}`}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={m.senderProfileImage || ""} />
                      <AvatarFallback className="text-xs">
                        {m.senderFirstName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] rounded-md px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p>{m.message.content}</p>
                      <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(m.message.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-2">
            <Textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder={t("messages.placeholder")}
              className="flex-1 min-h-[40px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (messageContent.trim()) sendMessageMutation.mutate();
                }
              }}
              data-testid="input-message"
            />
            <Button
              size="icon"
              onClick={() => { if (messageContent.trim()) sendMessageMutation.mutate(); }}
              disabled={!messageContent.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        donationId={donation?.id}
        requestId={requestId}
        flaggedUserId={isDonor ? req.requesterId : donation?.donorId}
        medicineName={donation && (isAr ? donation.medicineNameAr || donation.medicineNameEn : donation.medicineNameEn)}
      />
    </div>
  );
}
