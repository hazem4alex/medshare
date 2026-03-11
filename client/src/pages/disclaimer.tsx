import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle } from "lucide-react";

export default function DisclaimerPage() {
  const { t } = useTranslation();

  const bullets = [t("medDisclaimer.b1"), t("medDisclaimer.b2"), t("medDisclaimer.b3")];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-disclaimer-title">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          {t("medDisclaimer.title")}
        </h1>
        <p className="text-muted-foreground">{t("medDisclaimer.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm leading-relaxed">{t("medDisclaimer.intro")}</p>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                {b}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200 leading-relaxed" data-testid="text-disclaimer-closing">
        <p>{t("medDisclaimer.closing")}</p>
      </div>
    </div>
  );
}
