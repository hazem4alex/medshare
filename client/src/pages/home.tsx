import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { Package, ClipboardList, HeartHandshake, Search, TrendingUp, Inbox } from "lucide-react";

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<{
    activeDonations: number;
    pendingRequests: number;
    totalDonated: number;
    incomingPendingRequests: number;
  }>({
    queryKey: ["/api/dashboard"],
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold" data-testid="text-welcome">
          {t("home.welcomeBack", { name: user?.firstName || "User" })}
        </h1>
        <p className="text-muted-foreground">{t("home.dashboard")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 text-primary" />
                  {t("home.activeDonations")}
                </div>
                <p className="text-2xl font-bold" data-testid="text-active-donations">{stats?.activeDonations || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Inbox className="h-4 w-4 text-amber-500" />
                  {t("home.pendingRequests")}
                </div>
                <p className="text-2xl font-bold" data-testid="text-pending-requests">{stats?.incomingPendingRequests || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  {t("home.totalDonated")}
                </div>
                <p className="text-2xl font-bold" data-testid="text-total-donated">{stats?.totalDonated || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  {t("myRequests.title")}
                </div>
                <p className="text-2xl font-bold" data-testid="text-my-requests">{stats?.pendingRequests || 0}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("home.quickActions")}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/donate">
            <Card className="cursor-pointer hover-elevate">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <HeartHandshake className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t("nav.donate")}</p>
                  <p className="text-sm text-muted-foreground">{t("donate.subtitle")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/browse">
            <Card className="cursor-pointer hover-elevate">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{t("nav.browse")}</p>
                  <p className="text-sm text-muted-foreground">{t("browse.subtitle")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <MedicalDisclaimer />
    </div>
  );
}
