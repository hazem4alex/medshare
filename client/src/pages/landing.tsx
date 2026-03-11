import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { HeartHandshake, Shield, PackageCheck, Users, ArrowRight, Heart } from "lucide-react";
import { SiGoogle } from "react-icons/si";

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <HeartHandshake className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight" data-testid="text-app-name">{t("app.name")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <a href="/api/login">
              <Button data-testid="button-login" className="flex items-center gap-2">
                <SiGoogle className="h-4 w-4" />
                <span className="hidden sm:inline">{t("auth.loginWithGoogle")}</span>
              </Button>
            </a>
          </div>
        </div>
      </nav>

      <section className="relative py-20 sm:py-32 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1
                  className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight"
                  data-testid="text-hero-title"
                >
                  {t("landing.heroTitle")}
                </h1>
                <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                  {t("landing.heroSubtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/login">
                  <Button size="lg" data-testid="button-get-started" className="flex items-center gap-2">
                    <SiGoogle className="h-4 w-4" />
                    {t("auth.loginWithGoogle")}
                    <ArrowRight className="h-4 w-4 ms-1" />
                  </Button>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>{t("landing.charitableOnly")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-primary" />
                  <span>{t("landing.feature1Title")}</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="relative w-80 h-80">
                <div className="absolute inset-0 bg-primary/10 rounded-full" />
                <div className="absolute inset-8 bg-primary/20 rounded-full" />
                <div className="absolute inset-16 bg-primary/30 rounded-full flex items-center justify-center">
                  <HeartHandshake className="h-24 w-24 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-serif font-bold text-center mb-4" data-testid="text-how-it-works">
            {t("landing.howItWorks")}
          </h2>
          <div className="flex flex-wrap justify-center gap-8 mt-4 mb-12 text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">1</span>
              {t("landing.step1")}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">2</span>
              {t("landing.step2")}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">3</span>
              {t("landing.step3")}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 mx-auto flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{t("landing.feature1Title")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t("landing.feature1Desc")}</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 mx-auto flex items-center justify-center">
                  <PackageCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{t("landing.feature2Title")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t("landing.feature2Desc")}</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 mx-auto flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{t("landing.feature3Title")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t("landing.feature3Desc")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-12 border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 text-center space-y-4">
          <p className="text-sm text-foreground/80 max-w-xl mx-auto leading-relaxed">
            {t("landing.platformDesc")}
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>{t("landing.noCommercial")}</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <a href="/terms" className="hover:text-primary underline underline-offset-2 transition-colors" data-testid="link-terms">
              {t("nav.terms")}
            </a>
            <span>·</span>
            <a href="/disclaimer" className="hover:text-primary underline underline-offset-2 transition-colors" data-testid="link-disclaimer">
              {t("nav.medDisclaimer")}
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MedShare. {t("app.disclaimer")}
          </p>
        </div>
      </section>
    </div>
  );
}
