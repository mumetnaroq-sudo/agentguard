/**
 * Authentication utility functions
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Server-side authentication check
 * Redirects to sign-in if user is not authenticated
 */
export async function requireAuth() {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  
  if (!user) {
    redirect("/sign-in");
  }

  return { userId, user };
}

/**
 * Get current authenticated user (server-side)
 * Returns null if not authenticated (doesn't redirect)
 */
export async function getCurrentUser() {
  const { userId } = auth();

  if (!userId) {
    return null;
  }

  return await currentUser();
}

/**
 * Check if user is authenticated (server-side)
 */
export function isAuthenticated(): boolean {
  const { userId } = auth();
  return !!userId;
}

/**
 * Get authentication token for API requests
 */
export async function getAuthToken(): Promise<string | null> {
  const { getToken } = auth();
  return await getToken();
}

/**
 * Server-side redirect helper
 */
export function redirectToSignIn() {
  redirect("/sign-in");
}

export function redirectToDashboard() {
  redirect("/dashboard");
}
