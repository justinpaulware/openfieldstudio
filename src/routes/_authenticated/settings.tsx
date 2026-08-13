import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  isUsernameAvailable,
  normalizeUsername,
  validateUsername,
} from "@/lib/username";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Account settings — Open Field" },
      { name: "description", content: "Update your Open Field display name and account details." },
      { property: "og:title", content: "Account settings — Open Field" },
      { property: "og:description", content: "Manage your Open Field account." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["profile", "settings"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .eq("id", auth.user.id)
        .maybeSingle();
      return { email: auth.user.email ?? "", ...(profile ?? { id: auth.user.id, display_name: "", username: null }) };
    },
  });

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.display_name ?? "");
    setUsername(data.username ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const handle = normalizeUsername(username);
      if (handle || data.username) {
        const problem = validateUsername(handle);
        if (problem) throw new Error(problem);
        if (!(await isUsernameAvailable(handle, data.id))) {
          throw new Error("That username is already taken.");
        }
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          username: handle || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Account settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">How you appear across Open Field.</p>

      {isLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={data?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your-name"
            />
            <p className="font-secondary text-xs text-muted-foreground">
              Your published maps live at openfield.nu/
              {normalizeUsername(username) || "your-name"}/map-name
            </p>
          </div>
          <div className="flex justify-end border-t border-border pt-5">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
