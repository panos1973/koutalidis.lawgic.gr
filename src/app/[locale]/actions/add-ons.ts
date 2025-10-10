"use server";
import db from "@/db/drizzle";
import { addOns } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get all active add-ons from the database
 * @returns Array of active add-ons
 */
export const getAllActiveAddOns = async () => {
  // return db.select().from(addOns).where(eq(addOns.isActive, true));
  return db.select().from(addOns);
};
