"use server";
import db from "@/db/drizzle";
import { plans } from "@/db/schema";

export const getAllPlans = async () => {
  return db.select().from(plans);
};
