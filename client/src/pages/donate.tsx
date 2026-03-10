import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { Plus, Trash2, HeartHandshake, Camera, Loader2, AlertTriangle } from "lucide-react";
import type { MedicineCategory } from "@shared/schema";

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function separateText(text: string): { en: string; ar: string } {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const arParts: string[] = [];
  const enParts: string[] = [];
  for (const line of lines) {
    if (ARABIC_REGEX.test(line)) arParts.push(line);
    else if (/[a-zA-Z]/.test(line)) enParts.push(line);
  }
  return { en: enParts.join(" ").trim(), ar: arParts.join(" ").trim() };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function MedicineAutocomplete({
  value,
  onChange,
  dir,
  testId,
  label,
}: {
  value: string;
  onChange: (val: string) => void;
  dir?: string;
  testId: string;
  label: string;
}) {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [validated, setValidated] = useState<boolean | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebounce(value, 400);

  const { data: suggestions } = useQuery<string[]>({
    queryKey: [`/api/medicines/search?q=${encodeURIComponent(debouncedValue)}`],
    enabled: debouncedValue.length >= 2 && !ARABIC_REGEX.test(debouncedValue),
    staleTime: 60000,
  });

  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 2 || ARABIC_REGEX.test(debouncedValue)) {
      setValidated(null);
      return;
    }
    if (suggestions !== undefined) {
      const normalized = debouncedValue.toLowerCase().replace(/[^a-z0-9\s]/g, "");
      const found = suggestions.some((s) => {
        const sNorm = s.toLowerCase();
        return sNorm.includes(normalized) || normalized.includes(sNorm);
      });
      setValidated(found);
    }
  }, [suggestions, debouncedValue]);

  useEffect(() => {
    if (suggestions && suggestions.length > 0 && value.length >= 2) {
      setShowDropdown(true);
    }
  }, [suggestions, value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions && suggestions.length > 0 && value.length >= 2) setShowDropdown(true);
          }}
          dir={dir}
          data-testid={testId}
        />
        {showDropdown && suggestions && suggestions.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
            <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium border-b">
              {t("donate.suggestions")}
            </div>
            {suggestions.map((name, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-start px-3 py-2 text-sm hover:bg-accent cursor-pointer"
                onClick={() => {
                  onChange(name);
                  setShowDropdown(false);
                  setValidated(true);
                }}
                data-testid={`suggestion-${i}`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
      {validated === false && value.length >= 2 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" data-testid="text-unrecognized-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t("donate.unrecognizedWarning")}
        </p>
      )}
    </div>
  );
}

export default function DonatePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [medicineNameEn, setMedicineNameEn] = useState("");
  const [medicineNameAr, setMedicineNameAr] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantities, setQuantities] = useState([{ unit: "box", quantity: 1 }]);
  const [locationDescription, setLocationDescription] = useState("");
  const [locationCoords, setLocationCoords] = useState("");
  const [notes, setNotes] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useQuery<MedicineCategory[]>({ queryKey: ["/api/categories"] });

  const addQuantity = () => {
    setQuantities([...quantities, { unit: "box", quantity: 1 }]);
  };

  const removeQuantity = (idx: number) => {
    setQuantities(quantities.filter((_, i) => i !== idx));
  };

  const updateQuantity = (idx: number, field: string, value: any) => {
    const updated = [...quantities];
    (updated[idx] as any)[field] = field === "quantity" ? Number(value) : value;
    setQuantities(updated);
  };

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(file, "eng+ara", { logger: () => {} });
      const detectedText = result.data.text?.trim();
      if (!detectedText) {
        toast({ title: t("donate.scanNoText"), variant: "destructive" });
        return;
      }
      const { en, ar } = separateText(detectedText);
      if (en) setMedicineNameEn(en);
      if (ar) setMedicineNameAr(ar);
      if (!en && !ar) setMedicineNameEn(detectedText);
      toast({ title: t("donate.scanSuccess") });
    } catch (err) {
      console.error("OCR error:", err);
      toast({ title: t("common.error"), description: t("donate.scanError"), variant: "destructive" });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/donations", {
        medicineNameEn: medicineNameEn || medicineNameAr,
        medicineNameAr: medicineNameAr || medicineNameEn,
        categoryId: categoryId ? Number(categoryId) : null,
        expiryDate,
        quantities,
        locationDescription: locationDescription || null,
        locationCoords: locationCoords || null,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/donations/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: t("donate.success") });
      navigate("/my-donations");
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!medicineNameEn && !medicineNameAr) || !expiryDate || quantities.length === 0) return;
    const expiry = new Date(expiryDate);
    if (expiry <= new Date()) {
      toast({ title: t("donate.expiredError"), variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-donate-title">
          <HeartHandshake className="h-6 w-6 text-primary" />
          {t("donate.title")}
        </h1>
        <p className="text-muted-foreground">{t("donate.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("donate.title")}</CardTitle>
            <CardDescription>{t("donate.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">{t("donate.nameHint")}</p>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleScanImage}
                    data-testid="input-scan-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    data-testid="button-scan-medicine"
                  >
                    {isScanning ? (
                      <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5 me-1.5" />
                    )}
                    {isScanning ? t("donate.scanning") : t("donate.scanName")}
                  </Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <MedicineAutocomplete
                  value={medicineNameEn}
                  onChange={setMedicineNameEn}
                  testId="input-medicine-name-en"
                  label={t("donate.medicineNameEn")}
                />
                <div className="space-y-2">
                  <Label>{t("donate.medicineNameAr")}</Label>
                  <Input
                    value={medicineNameAr}
                    onChange={(e) => setMedicineNameAr(e.target.value)}
                    dir="rtl"
                    data-testid="input-medicine-name-ar"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("donate.category")}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder={t("donate.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nameEn} - {c.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("donate.expiryDate")}</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  data-testid="input-expiry-date"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-semibold">{t("donate.quantities")}</Label>
                <Button type="button" variant="secondary" size="sm" onClick={addQuantity} data-testid="button-add-quantity">
                  <Plus className="h-3 w-3 me-1" />
                  {t("donate.addQuantity")}
                </Button>
              </div>
              {quantities.map((q, idx) => (
                <div key={idx} className="flex items-end gap-3 p-3 bg-muted/30 rounded-md">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">{t("donate.unit")}</Label>
                    <Select value={q.unit} onValueChange={(val) => updateQuantity(idx, "unit", val)}>
                      <SelectTrigger data-testid={`select-unit-${idx}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="box">{t("donate.box")}</SelectItem>
                        <SelectItem value="strip">{t("donate.strip")}</SelectItem>
                        <SelectItem value="pill">{t("donate.pill")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">{t("donate.quantity")}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={q.quantity}
                      onChange={(e) => updateQuantity(idx, "quantity", e.target.value)}
                      data-testid={`input-quantity-${idx}`}
                    />
                  </div>
                  {quantities.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuantity(idx)}
                      data-testid={`button-remove-quantity-${idx}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>{t("donate.locationDescription")}</Label>
              <Textarea
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder={t("donate.locationDescPlaceholder")}
                data-testid="input-location-description"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("donate.locationCoords")}</Label>
              <Input
                value={locationCoords}
                onChange={(e) => setLocationCoords(e.target.value)}
                placeholder="https://maps.google.com/..."
                data-testid="input-location-coords"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("donate.notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("donate.notesPlaceholder")}
                data-testid="input-notes"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitMutation.isPending}
              data-testid="button-submit-donation"
            >
              {submitMutation.isPending ? t("donate.submitting") : t("donate.submit")}
            </Button>
          </CardContent>
        </Card>
      </form>

      <MedicalDisclaimer />
    </div>
  );
}
