"use client";

/**
 * Gets the current user ID from localStorage
 * This is used in client components to determine ownership of folders
 * for sharing functionality
 */
export const getCurrentUserId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("userId");
};

/**
 * Stores the current user ID in localStorage
 * This should be called when the user logs in
 */
export const setCurrentUserId = (userId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem("userId", userId);
};
