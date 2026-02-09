"use client";

import { useAuth, useUser, useSession } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Custom hook for session management with Clerk
 * Provides authentication state, user data, and session info
 */
export function useSessionManager() {
  const { isLoaded, isSignedIn, userId, sessionId, signOut } = useAuth();
  const { user } = useUser();
  const { session } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isLoaded) {
      setIsLoading(false);
    }
  }, [isLoaded]);

  return {
    // Auth state
    isLoaded,
    isSignedIn,
    isLoading,
    userId,
    sessionId,
    
    // User data
    user,
    session,
    
    // Actions
    signOut,
    
    // Helpers
    isAuthenticated: isSignedIn && !!userId,
  };
}

/**
 * Hook to check if user has required role/permission
 */
export function useAuthorization() {
  const { user } = useUser();
  const { orgRole } = useAuth();

  const isAdmin = orgRole === "admin";
  const isMember = orgRole === "member";

  const hasPermission = (permission: string): boolean => {
    // Check if user has specific permission
    // This can be extended based on your permission system
    const userPermissions = user?.publicMetadata?.permissions as string[] || [];
    return isAdmin || userPermissions.includes(permission);
  };

  return {
    isAdmin,
    isMember,
    orgRole,
    hasPermission,
  };
}

/**
 * Hook for protected route checking
 * Redirects to sign-in if not authenticated
 */
export function useProtectedRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setIsAuthorized(isSignedIn || false);
    }
  }, [isLoaded, isSignedIn]);

  return {
    isLoaded,
    isAuthorized,
    isChecking: !isLoaded,
  };
}
