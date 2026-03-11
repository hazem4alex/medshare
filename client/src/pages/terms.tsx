import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, AlertCircle } from "lucide-react";

export default function TermsPage() {
  const { t } = useTranslation();

  const sections = [
    { title: t("terms.s1title"), body: t("terms.s1"), bullets: null },
    {
      title: t("terms.s2title"),
      body: t("terms.s2"),
      bullets: [t("terms.s2b1"), t("terms.s2b2"), t("terms.s2b3"), t("terms.s2b4")],
    },
    { title: t("terms.s3title"), body: t("terms.s3"), bullets: null },
    {
      title: t("terms.s4title"),
      body: t("terms.s4"),
      bullets: [t("terms.s4b1"), t("terms.s4b2"), t("terms.s4b3"), t("terms.s4b4")],
    },
    { title: t("terms.s5title"), body: t("terms.s5"), bullets: null },
    {
      title: t("terms.s6title"),
      body: t("terms.s6"),
      bullets: [t("terms.s6b1"), t("terms.s6b2"), t("terms.s6b3")],
    },
    { title: t("terms.s7title"), body: t("terms.s7"), bullets: null },
    { title: t("terms.s8title"), body: t("terms.s8"), bullets: null },
    { title: t("terms.s9title"), body: t("terms.s9"), bullets: null },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-terms-title">
          <FileText className="h-6 w-6 text-primary" />
          {t("terms.title")}
        </h1>
        <p className="text-muted-foreground">{t("terms.subtitle")}</p>
      </div>

      <div className="space-y-4">
        {sections.map((section, i) => (
          <Card key={i} data-testid={`card-terms-section-${i + 1}`}>
            <CardContent className="p-5 space-y-2">
              <h2 className="font-semibold text-base text-primary">{section.title}</h2>
              <p className="text-sm text-foreground leading-relaxed">{section.body}</p>
              {section.bullets && (
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ps-2">
                  {section.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{t("app.disclaimer")}</p>
      </div>
    </div>
  );
}
