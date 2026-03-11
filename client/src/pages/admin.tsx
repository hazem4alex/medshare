import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Shield, Plus, Trash2, Flag, Check, Users, Ban, ShieldCheck } from "lucide-react";
import type { MedicineCategory } from "@shared/schema";

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const isRTL = i18n.dir() === "rtl";

  const [newCatNameEn, setNewCatNameEn] = useState("");
  const [newCatNameAr, setNewCatNameAr] = useState("");

  const { data: categories, isLoading: catLoading } = useQuery<MedicineCategory[]>({
    queryKey: ["/api/categories"],
  });

  const { data: flags, isLoading: flagsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/flags"],
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/categories", { nameEn: newCatNameEn, nameAr: newCatNameAr });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewCatNameEn("");
      setNewCatNameAr("");
      toast({ title: "Category added" });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Category deleted" });
    },
  });

  const reviewFlagMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/admin/flags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/flags"] });
      toast({ title: "Flag reviewed" });
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: "ban" | "unban" }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/${action}`);
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: action === "ban" ? t("admin.banUser") : t("admin.unbanUser") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold flex items-center gap-3" data-testid="text-admin-title">
          <Shield className="h-6 w-6 text-primary" />
          {t("admin.title")}
        </h1>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories" data-testid="tab-categories">{t("admin.categories")}</TabsTrigger>
          <TabsTrigger value="flags" data-testid="tab-flags">{t("admin.flags")}</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-3.5 w-3.5 me-1" />
            {t("admin.users")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("admin.addCategory")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("admin.categoryNameEn")}</Label>
                  <Input
                    value={newCatNameEn}
                    onChange={(e) => setNewCatNameEn(e.target.value)}
                    data-testid="input-cat-name-en"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.categoryNameAr")}</Label>
                  <Input
                    value={newCatNameAr}
                    onChange={(e) => setNewCatNameAr(e.target.value)}
                    dir="rtl"
                    data-testid="input-cat-name-ar"
                  />
                </div>
              </div>
              <Button
                onClick={() => addCategoryMutation.mutate()}
                disabled={!newCatNameEn || !newCatNameAr || addCategoryMutation.isPending}
                data-testid="button-add-category"
              >
                <Plus className="h-4 w-4 me-1" />
                {t("admin.addCategory")}
              </Button>
            </CardContent>
          </Card>

          {catLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {categories?.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-2 bg-muted/30 rounded-md p-3"
                  data-testid={`category-${cat.id}`}
                >
                  <div>
                    <span className="font-medium">{cat.nameEn}</span>
                    <span className="text-muted-foreground ms-2">({cat.nameAr})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCategoryMutation.mutate(cat.id)}
                    data-testid={`button-delete-cat-${cat.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="flags" className="space-y-4 mt-4">
          {flagsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !flags?.length ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Flag className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-flags">{t("admin.noFlags")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {flags.map((item: any) => (
                <Card key={item.id} data-testid={`flag-${item.id}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.report_type && item.report_type !== "system" && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {item.report_type.replace(/_/g, " ")}
                            </Badge>
                          )}
                          {item.report_type === "system" && (
                            <Badge variant="outline" className="text-xs">system</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{item.reason}</p>
                        {item.medicine_name_en && (
                          <p className="text-xs text-muted-foreground">
                            Medicine: {item.medicine_name_en}
                          </p>
                        )}
                        {item.flagged_user_first_name && (
                          <p className="text-xs text-muted-foreground">
                            Flagged user: {item.flagged_user_first_name} {item.flagged_user_last_name}
                          </p>
                        )}
                        {item.reporter_first_name && (
                          <p className="text-xs text-muted-foreground">
                            Reported by: {item.reporter_first_name} {item.reporter_last_name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.reviewed ? (
                          <Badge variant="secondary">Reviewed</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => reviewFlagMutation.mutate(item.id)}
                            data-testid={`button-review-${item.id}`}
                          >
                            <Check className="h-3 w-3 me-1" />
                            {t("admin.markReviewed")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          {usersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !allUsers?.length ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-users">{t("admin.noUsers")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {allUsers.map((user: any) => (
                <Card
                  key={user.id}
                  className={user.is_banned ? "border-destructive/30 bg-destructive/5" : ""}
                  data-testid={`user-card-${user.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={user.profile_image_url ?? undefined} />
                          <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm" data-testid={`text-user-name-${user.id}`}>
                              {user.first_name} {user.last_name}
                            </span>
                            {user.is_admin && (
                              <Badge variant="secondary" className="text-xs">
                                <ShieldCheck className="h-3 w-3 me-1" />
                                Admin
                              </Badge>
                            )}
                            {user.is_banned ? (
                              <Badge variant="destructive" className="text-xs" data-testid={`badge-banned-${user.id}`}>
                                <Ban className="h-3 w-3 me-1" />
                                {t("admin.banned")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-200" data-testid={`badge-active-${user.id}`}>
                                {t("admin.active")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          {user.country_name_en && (
                            <p className="text-xs text-muted-foreground">
                              {isRTL ? user.country_name_ar : user.country_name_en}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                        {!user.is_admin && (
                          user.is_banned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => banMutation.mutate({ userId: user.id, action: "unban" })}
                              disabled={banMutation.isPending}
                              data-testid={`button-unban-${user.id}`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 me-1 text-green-600" />
                              {t("admin.unbanUser")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => banMutation.mutate({ userId: user.id, action: "ban" })}
                              disabled={banMutation.isPending}
                              className="text-destructive border-destructive/30"
                              data-testid={`button-ban-${user.id}`}
                            >
                              <Ban className="h-3.5 w-3.5 me-1" />
                              {t("admin.banUser")}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
