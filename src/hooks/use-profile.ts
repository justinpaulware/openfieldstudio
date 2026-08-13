import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MyProfile = {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
};

/** The signed-in user's profile, including their public username namespace. */
export function useMyProfile() {
  return useQuery({
    queryKey: ["profile", "me"],
    queryFn: async (): Promise<MyProfile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .eq("id", auth.user.id)
        .maybeSingle();
      return {
        id: auth.user.id,
        email: auth.user.email ?? "",
        display_name: profile?.display_name ?? null,
        username: profile?.username ?? null,
      };
    },
  });
}
