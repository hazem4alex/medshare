import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "lucide-react";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  donationId?: number;
  requestId?: number;
  flaggedUserId?: string;
  medicineName?: string;
}

export function ReportDialog({ open, onClose, donationId, requestId, flaggedUserId, medicineName }: ReportDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [reportType, setReportType] = useState("");
  const [reason, setReason] = useState("");

  const reportTypes = [
    { value: "suspicious_medicine", label: t("report.typeSuspiciousMedicine") },
    { value: "suspicious_user", label: t("report.typeSuspiciousUser") },
    { value: "counterfeit", label: t("report.typeCounterfeit") },
    { value: "narcotic", label: t("report.typeNarcotic") },
    { value: "expired", label: t("report.typeExpired") },
    { value: "other", label: t("report.typeOther") },
  ];

  const reportMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/report", {
        reason: reason.trim(),
        reportType,
        flaggedUserId: flaggedUserId || null,
        relatedDonationId: donationId || null,
        relatedRequestId: requestId || null,
      });
    },
    onSuccess: () => {
      toast({ title: t("report.success") });
      setReportType("");
      setReason("");
      onClose();
    },
    onError: () => {
      toast({ title: t("report.error"), variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!reportType || !reason.trim()) return;
    reportMutation.mutate();
  };

  const handleClose = () => {
    setReportType("");
    setReason("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            {t("report.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("report.subtitle")}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {medicineName && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {medicineName}
            </div>
          )}

          <div className="space-y-1.5">
            <Label data-testid="label-report-type">{t("report.typeLabel")}</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger data-testid="select-report-type">
                <SelectValue placeholder={t("report.typeLabel")} />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value} data-testid={`option-report-${rt.value}`}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label data-testid="label-report-reason">{t("report.reasonLabel")}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("report.reasonPlaceholder")}
              rows={4}
              data-testid="textarea-report-reason"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-report">
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!reportType || !reason.trim() || reportMutation.isPending}
            data-testid="button-submit-report"
          >
            <Flag className="h-4 w-4 me-1.5" />
            {t("report.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
