import { createClient } from "@/lib/supabase/server";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    user: {
      id: user.id,
      name: user.user_metadata?.full_name ?? null,
      email: user.email ?? null,
      image: user.user_metadata?.avatar_url ?? null,
    },
  };
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
