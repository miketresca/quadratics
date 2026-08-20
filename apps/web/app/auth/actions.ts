"use server";

import {redirect} from "next/navigation";

import {createClient} from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? "/"));
  const email = usernameToAuthEmail(username);
  if (!email) {
    redirect(`${returnTo}?auth_error=invalid_credentials`);
  }

  const supabase = await createClient();
  const {error} = await supabase.auth.signInWithPassword({email, password});

  if (error) {
    redirect(`${returnTo}?auth_error=invalid_credentials`);
  }
  redirect(returnTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function usernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(normalized)) {
    return null;
  }
  return `${normalized}@quadratics.xyz`;
}

function safeReturnTo(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/";
  }
  return value.split("?")[0] || "/";
}
