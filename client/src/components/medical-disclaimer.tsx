import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

export function MedicalDisclaimer() {
  const { t } = useTranslation();

  return (
    <div
      className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-4 py-3 flex items-start gap-3"
      data-testid="text-medical-disclaimer"
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800 dark:text-amber-200">{t("app.disclaimer")}</p>
    </div>
  );
}
