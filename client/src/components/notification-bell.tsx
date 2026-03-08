import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, MessageSquare, ClipboardList, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { useState } from "react";

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const isAr = i18n.language === "ar";

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const { data: allNotifications, isLoading: notificationsLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: open,
    staleTime: 0,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  const getIcon = (type: string) => {
    switch (type) {
      case "new_request": return <Package className="h-4 w-4 text-primary shrink-0" />;
      case "new_message": return <MessageSquare className="h-4 w-4 text-blue-500 shrink-0" />;
      case "request_status": return <ClipboardList className="h-4 w-4 text-amber-500 shrink-0" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "new_request": return t("notifications.newRequest");
      case "new_message": return t("notifications.newMessage");
      case "request_status": return t("notifications.statusUpdate");
      default: return "";
    }
  };

  const handleClick = (notif: Notification) => {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    setOpen(false);

    if (notif.relatedRequestId) {
      queryClient.invalidateQueries({ queryKey: ["/api/requests", notif.relatedRequestId] });
      queryClient.invalidateQueries({ queryKey: ["/api/requests/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/donations/mine"] });
      navigate(`/requests/${notif.relatedRequestId}`);
    } else if (notif.relatedDonationId) {
      queryClient.invalidateQueries({ queryKey: ["/api/donations/mine"] });
      navigate("/my-donations");
    }
  };

  const formatTime = (date: string | Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return isAr ? "الآن" : "Just now";
    if (diffMins < 60) return isAr ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center rounded-full"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" data-testid="panel-notifications">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-semibold text-sm">{t("notifications.title")}</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1 px-2"
              onClick={() => markAllReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {notificationsLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : !allNotifications || allNotifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-no-notifications">
              {t("notifications.noNotifications")}
            </div>
          ) : (
            <div>
              {allNotifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-start px-4 py-3 flex items-start gap-3 transition-colors hover:bg-muted/50 ${
                    !notif.isRead ? "bg-primary/5" : ""
                  }`}
                  data-testid={`notification-item-${notif.id}`}
                >
                  <div className="mt-0.5">{getIcon(notif.type)}</div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">
                        {getTypeLabel(notif.type)}
                      </span>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm leading-snug truncate">
                      {isAr ? notif.titleAr : notif.titleEn}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatTime(notif.createdAt)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
