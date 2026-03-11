import { useTranslation } from "react-i18next";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BannedPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-destructive/10">
            <ShieldOff className="h-12 w-12 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-bold text-destructive" data-testid="text-banned-title">
            {t("banned.title")}
          </h1>
          <p className="text-muted-foreground" data-testid="text-banned-message">
            {t("banned.message")}
          </p>
        </div>
        <p className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30" data-testid="text-banned-contact">
          {t("banned.contact")}
        </p>
        <Button
          variant="outline"
          onClick={() => window.location.href = "/api/logout"}
          data-testid="button-banned-logout"
        >
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );
}
