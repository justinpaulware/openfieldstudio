import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderKanban,
  Globe2,
  MessageSquare,
  Settings,
  Layers,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Published maps", url: "/published", icon: Globe2 },
  { title: "Comments", url: "/comments", icon: MessageSquare },
] as const;

const HeaderSlotContext = createContext<HTMLElement | null>(null);

/** Renders `children` into the right side of the top app header band. */
export function AppHeaderSlot({ children }: { children: ReactNode }) {
  const node = useContext(HeaderSlotContext);
  if (!node) return null;
  return createPortal(children, node);
}

function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", auth.user.id)
        .maybeSingle();
      return { email: auth.user.email ?? "", ...(data ?? {}) };
    },
  });
}

function BrandMenu() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="-ml-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Layers className="h-4 w-4" />
        </span>
        <span className="font-display text-sm font-semibold">Open Field</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={9} className="w-60">
        {navItems.map((item) => (
          <DropdownMenuItem key={item.title} asChild>
            <Link
              to={item.url}
              className={
                pathname.startsWith(item.url) ? "font-semibold text-foreground" : undefined
              }
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.title}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials = (profile?.display_name || profile?.email || "?").slice(0, 2).toUpperCase();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="h-7 w-7">
          {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={9} className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2 font-normal">
          <Avatar className="h-7 w-7 shrink-0">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {profile?.display_name || "Account"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{profile?.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <HeaderSlotContext.Provider value={slot}>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
        <header className="flex h-12 shrink-0 items-center justify-between gap-x-6 border-b border-border px-4">
          <BrandMenu />
          <div className="flex items-center gap-3">
            <div ref={setSlot} className="flex items-center gap-1" />
            <AccountMenu />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </HeaderSlotContext.Provider>
  );
}
