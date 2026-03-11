import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { Search, MapPin, Calendar, AlertTriangle, Package, CheckCircle, Flag } from "lucide-react";
import { ReportDialog } from "@/components/report-dialog";
import type { MedicineCategory } from "@shared/schema";

function isNearExpiry(expiryDate: string): boolean {
  const exp = new Date(expiryDate);
  const now = new Date();
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 30 && diffDays > 0;
}

export default function BrowsePage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedDonation, setSelectedDonation] = useState<any>(null);
  const [requestQuantities, setRequestQuantities] = useState<Array<{ unit: string; quantity: number }>>([]);
  const [reportTarget, setReportTarget] = useState<{ donationId?: number; flaggedUserId?: string; medicineName?: string } | null>(null);

  const { data: categories } = useQuery<MedicineCategory[]>({ queryKey: ["/api/categories"] });

  const { data: myRequests } = useQuery<any[]>({ queryKey: ["/api/requests/mine"] });

  const requestedDonationIds = new Set(
    myRequests
      ?.filter((r: any) => r.request.status === "pending" || r.request.status === "approved")
      .map((r: any) => r.request.donationId) || []
  );

  const searchParams = new URLSearchParams();
  if (search) searchParams.set("search", search);
  if (categoryFilter && categoryFilter !== "all") searchParams.set("categoryId", categoryFilter);

  const { data: results, isLoading } = useQuery<any[]>({
    queryKey: [`/api/donations/search?${searchParams.toString()}`],
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/requests", {
        donationId: selectedDonation.donation.id,
        requestedQuantities: requestQuantities.filter(q => q.quantity > 0),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("request.success") });
      setSelectedDonation(null);
      queryClient.invalidateQueries({ queryKey: ["/api/requests/mine"] });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const openRequestDialog = (item: any) => {
    setSelectedDonation(item);
    const qtys = (item.donation.quantities as any[]).map((q: any) => ({
      unit: q.unit,
      quantity: Math.min(1, q.remaining),
    }));
    setRequestQuantities(qtys);
  };

  const unitLabel = (unit: string) => {
    const map: Record<string, string> = { box: t("units.box"), strip: t("units.strip"), pill: t("units.pill") };
    return map[unit] || unit;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-browse-title">
          <Search className="h-6 w-6 text-primary" />
          {t("browse.title")}
        </h1>
        <p className="text-muted-foreground">{t("browse.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            type="search"
            placeholder={t("browse.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48" data-testid="select-filter-category">
            <SelectValue placeholder={t("browse.filterCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("browse.allCategories")}</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {isAr ? c.nameAr : c.nameEn}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !results?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-results">{t("browse.noResults")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {results.map((item: any) => {
            const d = item.donation;
            const nearExpiry = isNearExpiry(d.expiryDate);
            const alreadyRequested = requestedDonationIds.has(d.id);

            return (
              <Card key={d.id} className="hover-elevate" data-testid={`card-donation-${d.id}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">
                        {isAr ? d.medicineNameAr || d.medicineNameEn : d.medicineNameEn}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isAr ? d.medicineNameEn : d.medicineNameAr}
                      </p>
                    </div>
                    {nearExpiry && (
                      <Badge variant="destructive" className="shrink-0">
                        <AlertTriangle className="h-3 w-3 me-1" />
                        {t("browse.nearExpiry")}
                      </Badge>
                    )}
                  </div>

                  {item.category && (
                    <Badge variant="secondary">
                      {isAr ? item.category.nameAr : item.category.nameEn}
                    </Badge>
                  )}

                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {t("browse.expiresOn")}: {new Date(d.expiryDate).toLocaleDateString()}
                    </div>
                    {(item.governorateName || d.locationDescription) && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {isAr ? item.governorateNameAr : item.governorateName}
                        {d.locationDescription && ` - ${d.locationDescription}`}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(d.quantities as any[]).map((q: any, i: number) => (
                      q.remaining > 0 && (
                        <Badge key={i} variant="outline">
                          {q.remaining} {unitLabel(q.unit)}
                        </Badge>
                      )
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {t("browse.donatedBy")}: {item.donorFirstName} {item.donorLastName?.[0]}.
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title={t("report.reportMedicine")}
                        onClick={() => setReportTarget({ donationId: d.id, flaggedUserId: d.donorId, medicineName: isAr ? d.medicineNameAr || d.medicineNameEn : d.medicineNameEn })}
                        data-testid={`button-report-${d.id}`}
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </Button>
                      {alreadyRequested ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {t("browse.alreadyRequested")}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => openRequestDialog(item)}
                          data-testid={`button-request-${d.id}`}
                        >
                          {t("browse.requestMedicine")}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedDonation} onOpenChange={() => setSelectedDonation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("request.title")}</DialogTitle>
          </DialogHeader>
          {selectedDonation && (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                {isAr
                  ? selectedDonation.donation.medicineNameAr || selectedDonation.donation.medicineNameEn
                  : selectedDonation.donation.medicineNameEn}
              </p>
              <p className="text-sm text-muted-foreground">{t("request.selectQuantity")}</p>
              {requestQuantities.map((q, idx) => {
                const available = (selectedDonation.donation.quantities as any[])[idx];
                if (!available || available.remaining <= 0) return null;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <Label className="w-20">{unitLabel(q.unit)}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={available.remaining}
                      value={q.quantity}
                      onChange={(e) => {
                        const updated = [...requestQuantities];
                        updated[idx].quantity = Math.min(Number(e.target.value), available.remaining);
                        setRequestQuantities(updated);
                      }}
                      className="w-24"
                      data-testid={`input-request-qty-${idx}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      / {available.remaining} {t("browse.available")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedDonation(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || requestQuantities.every(q => q.quantity <= 0)}
              data-testid="button-submit-request"
            >
              {requestMutation.isPending ? t("request.submitting") : t("request.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MedicalDisclaimer />

      <ReportDialog
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        donationId={reportTarget?.donationId}
        flaggedUserId={reportTarget?.flaggedUserId}
        medicineName={reportTarget?.medicineName}
      />
    </div>
  );
}
