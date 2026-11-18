import { supabase } from "../lib/supabase";

export async function loginInternal(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function logoutInternal() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function getInternalSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return data.session;
}

export function subscribeAuthChanges(callback) {
  const { data } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );

  return () => data.subscription.unsubscribe();
}

export async function getInternalProfile() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Pengguna belum login.");
  }

  const response = await fetch("/api/auth/me/", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Verifikasi pengguna gagal (HTTP ${response.status}).`
    );
  }

  return response.json();
}
