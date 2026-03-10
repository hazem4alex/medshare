import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { HeartHandshake, Mail, Info } from "lucide-react";
import { SiLinkedin } from "react-icons/si";

export default function AboutPage() {
  const { t } = useTranslation();

  const faqs: { q: string; a: string }[] = [
    { q: t("about.faq1q"), a: t("about.faq1a") },
    { q: t("about.faq2q"), a: t("about.faq2a") },
    { q: t("about.faq3q"), a: t("about.faq3a") },
    { q: t("about.faq4q"), a: t("about.faq4a") },
    { q: t("about.faq5q"), a: t("about.faq5a") },
    { q: t("about.faq6q"), a: t("about.faq6a") },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-about-title">
          <Info className="h-6 w-6 text-primary" />
          {t("about.title")}
        </h1>
        <p className="text-muted-foreground">{t("about.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HeartHandshake className="h-5 w-5 text-primary" />
            {t("about.missionTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p data-testid="text-about-mission">{t("about.mission1")}</p>
          <p>{t("about.mission2")}</p>
          <p>{t("about.mission3")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("about.faqTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" data-testid="accordion-faq">
            {faqs.map((faq, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`} data-testid={`faq-item-${idx}`}>
                <AccordionTrigger className="text-sm text-start">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            {t("about.feedbackTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("about.feedbackDesc")}</p>
          <a
            href="mailto:feedback@medshare.site"
            className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline"
            data-testid="link-feedback-email"
          >
            <Mail className="h-4 w-4" />
            feedback@medshare.site
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("about.developerTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-lg">H</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold" data-testid="text-developer-name">Hazem Badawy</p>
            <p className="text-sm text-muted-foreground">{t("about.developerRole")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            data-testid="link-linkedin"
          >
            <a
              href="https://www.linkedin.com/in/hazem-ramadan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <SiLinkedin className="h-4 w-4 text-[#0A66C2]" />
              LinkedIn
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
