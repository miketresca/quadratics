"use server";

import {redirect} from "next/navigation";

import {createClient} from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const {error} = await supabase.auth.signInWithPassword({email, password});

  if (error) {
    redirect("/app?auth_error=invalid_credentials");
  }
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app");
}
