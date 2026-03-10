import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { Plus, Trash2, HeartHandshake, Camera, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import type { MedicineCategory } from "@shared/schema";

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

async function preprocessImageForOcr(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_DIM = 1600;
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Convert to grayscale
      const gray = new Uint8Array(width * height);
      for (let i = 0; i < gray.length; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      // Contrast stretching: remap min–max to 0–255
      let min = 255, max = 0;
      for (const v of gray) { if (v < min) min = v; if (v > max) max = v; }
      const range = max - min || 1;

      // Apply threshold at midpoint of the stretched range
      for (let i = 0; i < gray.length; i++) {
        const stretched = Math.round(((gray[i] - min) / range) * 255);
        const binary = stretched > 128 ? 255 : 0;
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = binary;
        data[i * 4 + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      }, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

const NO_VOWELS = /^[^aeiouAEIOU]{1,3}$/;
const NOISE_PATTERNS = /^[\d\W]+$|^[^a-zA-Z]+$/;

function extractConfidentWords(words: Array<{ text: string; confidence: number }>): string {
  return words
    .filter(w => w.confidence >= 55)
    .map(w => w.text.trim().replace(/[^a-zA-Z0-9\-]/g, ""))
    .filter(w => w.length >= 3)
    .filter(w => !NOISE_PATTERNS.test(w))
    .filter(w => !NO_VOWELS.test(w))
    .join(" ")
    .trim();
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
  const [scanProgress, setScanProgress] = useState("");
  const [ocrPreview, setOcrPreview] = useState<{ en: string; ar: string } | null>(null);
  const [editedEn, setEditedEn] = useState("");
  const [editedAr, setEditedAr] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useQuery<MedicineCategory[]>({ queryKey: ["/api/categories"] });

  const addQuantity = () => setQuantities([...quantities, { unit: "box", quantity: 1 }]);
  const removeQuantity = (idx: number) => setQuantities(quantities.filter((_, i) => i !== idx));
  const updateQuantity = (idx: number, field: string, value: any) => {
    const updated = [...quantities];
    (updated[idx] as any)[field] = field === "quantity" ? Number(value) : value;
    setQuantities(updated);
  };

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsScanning(true);
    setScanProgress(t("donate.scanningPreprocess"));

    try {
      const processedBlob = await preprocessImageForOcr(file);

      setScanProgress(t("donate.scanningEn"));

      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(processedBlob, "eng", { logger: () => {} });

      const extracted = extractConfidentWords(result.data.words as Array<{ text: string; confidence: number }>);

      if (!extracted) {
        toast({ title: t("donate.scanNoText"), variant: "destructive" });
        return;
      }

      setEditedEn(extracted);
      setEditedAr(extracted);
      setOcrPreview({ en: extracted, ar: extracted });
    } catch (err) {
      console.error("OCR error:", err);
      toast({ title: t("common.error"), description: t("donate.scanError"), variant: "destructive" });
    } finally {
      setIsScanning(false);
      setScanProgress("");
    }
  };

  const applyOcrResults = () => {
    if (editedEn) setMedicineNameEn(editedEn);
    if (editedAr) setMedicineNameAr(editedAr);
    setOcrPreview(null);
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
                <p className="text-sm text-muted-foreground">{t("donate.scanTip")}</p>
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
                    {isScanning ? (scanProgress || t("donate.scanning")) : t("donate.scanName")}
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

      <Dialog open={!!ocrPreview} onOpenChange={() => setOcrPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              {t("donate.scanPreviewTitle")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("donate.scanPreviewDesc")}</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("donate.medicineNameEn")}</Label>
              <Input
                value={editedEn}
                onChange={(e) => setEditedEn(e.target.value)}
                placeholder={t("donate.scanNoTextPlaceholder")}
                data-testid="input-ocr-en"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("donate.medicineNameAr")}</Label>
              <Input
                value={editedAr}
                onChange={(e) => setEditedAr(e.target.value)}
                dir="rtl"
                placeholder={t("donate.scanNoTextPlaceholder")}
                data-testid="input-ocr-ar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOcrPreview(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={applyOcrResults}
              disabled={!editedEn && !editedAr}
              data-testid="button-apply-ocr"
            >
              <CheckCircle className="h-3.5 w-3.5 me-1.5" />
              {t("donate.scanApply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
