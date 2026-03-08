import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Calendar, Clock, ArrowRight } from "lucide-react";

export default function MyRequestsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  const { data: myRequests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/requests/mine"],
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
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-my-requests-title">
          <ClipboardList className="h-6 w-6 text-primary" />
          {t("myRequests.title")}
        </h1>
        <p className="text-muted-foreground">{t("myRequests.subtitle")}</p>
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
      ) : !myRequests?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-requests">{t("myRequests.noRequests")}</p>
            <Link href="/browse">
              <Button className="mt-4">{t("nav.browse")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {myRequests.map((item: any) => {
            const r = item.request;
            const d = item.donation;

            return (
              <Card key={r.id} className="hover-elevate" data-testid={`card-my-request-${r.id}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold">
                        {d && (isAr ? d.medicineNameAr || d.medicineNameEn : d.medicineNameEn)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("browse.donatedBy")}: {item.donorFirstName} {item.donorLastName}
                      </p>
                    </div>
                    {statusBadge(r.status)}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(r.requestedQuantities as any[]).map((q: any, i: number) => (
                      <Badge key={i} variant="outline">
                        {q.quantity} {unitLabel(q.unit)}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {r.proposedDeliveryDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(r.proposedDeliveryDate).toLocaleDateString()}
                      </div>
                    )}
                    {r.proposedDeliveryTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {r.proposedDeliveryTime}
                      </div>
                    )}
                  </div>

                  {(r.status === "approved" || r.status === "delivered") && (
                    <Link href={`/requests/${r.id}`}>
                      <Button size="sm" variant="secondary" data-testid={`button-view-details-${r.id}`}>
                        {t("myRequests.viewDetails")}
                        <ArrowRight className="h-3.5 w-3.5 ms-1" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
