"use server";

import { auth } from "@clerk/nextjs/server";
import db from "@/db/drizzle";

import { revalidatePath } from "next/cache";
import { organizations } from "@/db/schema";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";

/**
 * Creates a new organization with the provided data
 */
export async function createOrganization(formData: FormData) {
  try {
    const { userId } = auth();

    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Extract form data
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const taxId = formData.get("taxId") as string;
    const vatNumber = formData.get("vatNumber") as string;
    const registrationNumber = formData.get("registrationNumber") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const state = formData.get("state") as string;
    const postalCode = formData.get("postalCode") as string;
    const country = formData.get("country") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const planId = formData.get("planId") as string;
    const interval = formData.get("interval") as string;
    const paymentProofFile = formData.get("paymentProof") as File;

    if (
      !name ||
      !address ||
      !city ||
      !postalCode ||
      !country ||
      !email ||
      !phone ||
      !planId ||
      !interval ||
      !paymentProofFile
    ) {
      return { success: false, error: "Missing required fields" };
    }

    const { downloadUrl: paymentProofUrl } = await put(
      `payment-proofs/${paymentProofFile.name}`,
      paymentProofFile,
      {
        access: "public",
      }
    );

    // Create organization in database
    const [newOrganization] = await db
      .insert(organizations)
      .values({
        name,
        description: description || null,
        taxId: taxId || null,
        vatNumber: vatNumber || null,
        registrationNumber: registrationNumber || null,
        address,
        city,
        state: state || null,
        postalCode,
        country,
        email,
        phone,
        planId,
        paymentProofUrl,
        createdById: userId,
        status: "pending",
        paymentInterval: interval,
      })
      .returning();

    // Revalidate organization pages
    revalidatePath("/[locale]/organization/waiting");

    return { success: true, organization: newOrganization };
  } catch (error) {
    console.error("Error creating organization:", error);
    return { success: false, error: "Failed to create organization" };
  }
}

export async function verifyOrganizationSelection(locale?: string) {
  const { sessionClaims } = auth();

  // Check if user has an organization in sessionClaims
  if (!sessionClaims?.o) {
    // If no organization is set in sessionClaims, return false
    return { success: false, message: "No organization selected" };
  } else {
    // Return organization data from sessionClaims
    return {
      success: true,
      // @ts-ignore
      orgId: sessionClaims.o.id!,
      // @ts-ignore
      orgRole: sessionClaims.o.rol,
      // @ts-ignore
      orgSlug: sessionClaims.o.slg,
    };
  }
}

/**
 * Checks if the current user has a pending organization approval
 * @returns Object containing pending status and organization data if applicable
 */
export async function checkPendingOrgApproval(authInstance?: any) {
  const { userId } = authInstance ? authInstance() : auth();

  console.log("Checking pending org approval for user:", userId);

  if (!userId) {
    return { hasPendingApproval: false, organization: null };
  }

  // Check if user has created an organization that is pending approval
  const pendingOrgs = await db
    .select()
    .from(organizations)
    .where(
      eq(organizations.createdById, userId) &&
        eq(organizations.status, "pending")
    );

  if (pendingOrgs.length > 0) {
    return {
      hasPendingApproval: true,
      organization: pendingOrgs[0],
    };
  }

  return { hasPendingApproval: false, organization: pendingOrgs[0] };
}
