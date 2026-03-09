import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { User, MapPin } from "lucide-react";
import type { Country, Governorate, Area, UserProfile } from "@shared/schema";

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAr = i18n.language === "ar";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [countryId, setCountryId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [areaId, setAreaId] = useState("");

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: countriesList } = useQuery<Country[]>({ queryKey: ["/api/countries"] });
  const { data: governoratesList } = useQuery<Governorate[]>({
    queryKey: ["/api/governorates", countryId],
    enabled: !!countryId,
  });
  const { data: areasList } = useQuery<Area[]>({
    queryKey: ["/api/areas", governorateId],
    enabled: !!governorateId,
  });

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setProfileImageUrl(user.profileImageUrl || "");
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setCountryId(profile.countryId ? String(profile.countryId) : "");
      setGovernorateId(profile.governorateId ? String(profile.governorateId) : "");
      setAreaId(profile.areaId ? String(profile.areaId) : "");
    }
  }, [profile]);

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/auth/user", { firstName, lastName, profileImageUrl: profileImageUrl || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: t("profile.updateSuccess") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/profile", {
        countryId: Number(countryId),
        governorateId: governorateId ? Number(governorateId) : null,
        areaId: areaId ? Number(areaId) : null,
        declarationAccepted: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: t("profile.updateSuccess") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const initials = [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U";

  if (profileLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-profile-title">
          <User className="h-6 w-6 text-primary" />
          {t("profile.editProfile")}
        </h1>
        <p className="text-muted-foreground">{t("profile.editProfileDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("profile.personalInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profileImageUrl || ""} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label>{t("profile.photoUrl")}</Label>
              <Input
                value={profileImageUrl}
                onChange={(e) => setProfileImageUrl(e.target.value)}
                placeholder={t("profile.photoUrlPlaceholder")}
                data-testid="input-profile-image"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("profile.firstName")}</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("profile.lastName")}</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                data-testid="input-last-name"
              />
            </div>
          </div>

          <Button
            onClick={() => updateUserMutation.mutate()}
            disabled={updateUserMutation.isPending}
            className="w-full"
            data-testid="button-save-personal"
          >
            {updateUserMutation.isPending ? t("profile.saving") : t("profile.savePersonalInfo")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {t("profile.locationInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t("profile.country")}</Label>
            <Select value={countryId} onValueChange={(val) => { setCountryId(val); setGovernorateId(""); setAreaId(""); }}>
              <SelectTrigger data-testid="select-profile-country">
                <SelectValue placeholder={t("profile.selectCountry")} />
              </SelectTrigger>
              <SelectContent>
                {countriesList?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {isAr ? c.nameAr : c.nameEn} - {isAr ? c.nameEn : c.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {countryId && (
            <div className="space-y-2">
              <Label>{t("profile.governorate")}</Label>
              <Select value={governorateId} onValueChange={(val) => { setGovernorateId(val); setAreaId(""); }}>
                <SelectTrigger data-testid="select-profile-governorate">
                  <SelectValue placeholder={t("profile.selectGovernorate")} />
                </SelectTrigger>
                <SelectContent>
                  {governoratesList?.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {isAr ? g.nameAr : g.nameEn} - {isAr ? g.nameEn : g.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {governorateId && (
            <div className="space-y-2">
              <Label>{t("profile.area")}</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger data-testid="select-profile-area">
                  <SelectValue placeholder={t("profile.selectArea")} />
                </SelectTrigger>
                <SelectContent>
                  {areasList?.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {isAr ? a.nameAr : a.nameEn} - {isAr ? a.nameEn : a.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={() => updateLocationMutation.mutate()}
            disabled={updateLocationMutation.isPending || !countryId}
            className="w-full"
            data-testid="button-save-location"
          >
            {updateLocationMutation.isPending ? t("profile.saving") : t("profile.saveLocation")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
