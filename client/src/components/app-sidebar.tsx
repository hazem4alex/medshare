import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Home, Search, HeartHandshake, Package, ClipboardList, Shield, LogOut } from "lucide-react";
import type { UserProfile } from "@shared/schema";

export function AppSidebar() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [location] = useLocation();
  const isRTL = i18n.dir() === "rtl";

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const menuItems = [
    { title: t("nav.home"), url: "/", icon: Home },
    { title: t("nav.browse"), url: "/browse", icon: Search },
    { title: t("nav.donate"), url: "/donate", icon: HeartHandshake },
    { title: t("nav.myDonations"), url: "/my-donations", icon: Package },
    { title: t("nav.myRequests"), url: "/my-requests", icon: ClipboardList },
  ];

  if (profile?.isAdmin) {
    menuItems.push({ title: t("nav.admin"), url: "/admin", icon: Shield });
  }

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "U";

  return (
    <Sidebar side={isRTL ? "right" : "left"}>
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer" data-testid="link-home-logo">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center">
              <HeartHandshake className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">{t("app.name")}</h1>
              <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.home")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url}
                    className="data-[active=true]:bg-sidebar-accent"
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "home"}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || ""} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-user-name">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <a href="/api/logout" data-testid="button-logout">
            <LogOut className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
