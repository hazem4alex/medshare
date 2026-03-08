import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import type { Country, Governorate, Area } from "@shared/schema";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { HeartHandshake } from "lucide-react";

export default function ProfileSetupPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [countryId, setCountryId] = useState<string>("");
  const [governorateId, setGovernorateId] = useState<string>("");
  const [areaId, setAreaId] = useState<string>("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const { data: countries } = useQuery<Country[]>({ queryKey: ["/api/countries"] });
  const { data: governorates } = useQuery<Governorate[]>({
    queryKey: ["/api/governorates", countryId],
    enabled: !!countryId,
  });
  const { data: areasList } = useQuery<Area[]>({
    queryKey: ["/api/areas", governorateId],
    enabled: !!governorateId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/profile", {
        countryId: Number(countryId),
        governorateId: governorateId ? Number(governorateId) : null,
        areaId: areaId ? Number(areaId) : null,
        declarationAccepted,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: t("profile.save"), description: "Profile saved successfully" });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-md bg-primary mx-auto flex items-center justify-center">
            <HeartHandshake className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-serif font-bold" data-testid="text-profile-setup-title">{t("profile.setup")}</h1>
          <p className="text-muted-foreground text-sm">{t("profile.setupDesc")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("profile.setup")}</CardTitle>
            <CardDescription>{t("profile.setupDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t("profile.country")}</Label>
              <Select value={countryId} onValueChange={(val) => { setCountryId(val); setGovernorateId(""); setAreaId(""); }}>
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder={t("profile.selectCountry")} />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nameEn} - {c.nameAr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {countryId && (
              <div className="space-y-2">
                <Label>{t("profile.governorate")}</Label>
                <Select value={governorateId} onValueChange={(val) => { setGovernorateId(val); setAreaId(""); }}>
                  <SelectTrigger data-testid="select-governorate">
                    <SelectValue placeholder={t("profile.selectGovernorate")} />
                  </SelectTrigger>
                  <SelectContent>
                    {governorates?.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.nameEn} - {g.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {governorateId && (
              <div className="space-y-2">
                <Label>{t("profile.area")}</Label>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger data-testid="select-area">
                    <SelectValue placeholder={t("profile.selectArea")} />
                  </SelectTrigger>
                  <SelectContent>
                    {areasList?.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.nameEn} - {a.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Label className="font-semibold">{t("profile.declaration")}</Label>
              <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground leading-relaxed">
                {t("app.declarationText")}
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="declaration"
                  checked={declarationAccepted}
                  onCheckedChange={(c) => setDeclarationAccepted(!!c)}
                  data-testid="checkbox-declaration"
                />
                <label htmlFor="declaration" className="text-sm cursor-pointer">
                  {t("profile.acceptDeclaration")}
                </label>
              </div>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!countryId || !declarationAccepted || saveMutation.isPending}
              className="w-full"
              data-testid="button-save-profile"
            >
              {saveMutation.isPending ? t("profile.saving") : t("profile.save")}
            </Button>
          </CardContent>
        </Card>

        <MedicalDisclaimer />
      </div>
    </div>
  );
}
