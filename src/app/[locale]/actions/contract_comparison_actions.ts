"use server";

import db from "@/db/drizzle";
import {
  contract_comparison,
  contract_comparison_files,
  contract_comparison_messages,
  user_contract_comparison_preferences,
  vault_files,
} from "@/db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateObject } from "ai";
import { z } from "zod";
import { getLLMModel } from "@/lib/models/llmModelFactory";
import { cookies } from "next/headers";

let cachedLLMModel: any = null;

const getLocaleFromCookies = () => {
  const cookieStore = cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE");
  return localeCookie ? localeCookie.value : "el"; // Default to Greek
};

export const getContractComparisonPreferences = async (userId: string) => {
  const prefs = await db
    .select()
    .from(user_contract_comparison_preferences)
    .where(eq(user_contract_comparison_preferences.userId, userId))
    .limit(1);

  if (prefs.length === 0) {
    const defaultPrefs = await db
      .insert(user_contract_comparison_preferences)
      .values({
        userId,
        includeGreekLaws: true,
        includeGreekCourtDecisions: true,
        includeEuropeanLaws: false,
        includeEuropeanCourtDecisions: false,
        includeGreekBibliography: false,
        includeForeignBibliography: false,
      })
      .returning();

    return defaultPrefs[0];
  }

  return prefs[0];
};

export const updateContractComparisonPreferences = async (
  userId: string,
  preferences: {
    includeGreekLaws?: boolean;
    includeGreekCourtDecisions?: boolean;
    includeEuropeanLaws?: boolean;
    includeEuropeanCourtDecisions?: boolean;
    includeGreekBibliography?: boolean;
    includeForeignBibliography?: boolean;
  }
) => {
  const locale = getLocaleFromCookies();
  await db
    .update(user_contract_comparison_preferences)
    .set({
      ...preferences,
      updatedAt: new Date(),
    })
    .where(eq(user_contract_comparison_preferences.userId, userId));

  revalidatePath(`/${locale}/compare-contract`);
};

export const getContractComparisons = async (userId: string) => {
  return await db
    .select()
    .from(contract_comparison)
    .where(eq(contract_comparison.userId, userId))
    .orderBy(desc(contract_comparison.createdAt));
};

export const deleteMultipleContractComparisons = async (
  comparisonIds: string[]
) => {
  const locale = getLocaleFromCookies();

  if (comparisonIds.length === 0) return;

  await db
    .delete(contract_comparison)
    .where(inArray(contract_comparison.id, comparisonIds));

  revalidatePath(`/${locale}/compare-contract`);
};

export const updateContractComparisonNote = async (
  comparisonId: string,
  note: string
) => {
  const locale = getLocaleFromCookies();
  await db
    .update(contract_comparison)
    .set({ note })
    .where(eq(contract_comparison.id, comparisonId));

  revalidatePath(`/${locale}/compare-contract`);
  revalidatePath(`/${locale}/compare-contract/${comparisonId}`);
};

export const createContractComparison = async (userId: string) => {
  const locale = getLocaleFromCookies();
  const data = await db
    .insert(contract_comparison)
    .values({ userId, title: generateComparisonTitle(locale) })
    .returning({ comparisonId: contract_comparison.id });
  const comparisonId = data[0].comparisonId;
  revalidatePath(`/${locale}/compare-contract/`);
  return comparisonId;
};

export const createMeaningfulComparisonTitle = async (
  comparisonId: string,
  context: string
) => {
  const locale = getLocaleFromCookies();
  console.log(comparisonId);

  if (!cachedLLMModel) {
    cachedLLMModel = await getLLMModel("claude-3-haiku@20240307");
  }

  const { object: title } = await generateObject({
    model: cachedLLMModel,
    system: `
      You can generate meaningful contract comparison titles 
      based on chat context.
      Titles must be compact and meaningful.
      Use the context provided to generate title.
      Titles must be no longer than 120 characters.
      The title should always be in ${locale === "el" ? "Greek" : "English"}.
      `,
    prompt: `Generate a title based on this context: ${context}`,
    schema: z.object({
      title: z.string().describe("Title of the contract comparison"),
    }),
  });

  await db
    .update(contract_comparison)
    .set({
      title: title.title,
    })
    .where(eq(contract_comparison.id, comparisonId));

  // Revalidate paths to update the frontend
  revalidatePath(`/${locale}/compare-contract`);
  revalidatePath(`/${locale}/compare-contract/${comparisonId}`);
};

const generateComparisonTitle = (locale: string) => {
  return locale === "el"
    ? `Σύγκριση Συμβάσεων ${Math.floor(Math.random() * 10000).toFixed(0)}`
    : `Contract Comparison ${Math.floor(Math.random() * 10000).toFixed(0)}`;
};

export const deleteContractComparison = async (comparisonId: string) => {
  const locale = getLocaleFromCookies();
  await db
    .delete(contract_comparison)
    .where(eq(contract_comparison.id, comparisonId));
  revalidatePath(`/${locale}/compare-contract`);
  redirect(`/${locale}/compare-contract`);
};

export const getContractComparison = async (comparisonId: string) => {
  return await db
    .select()
    .from(contract_comparison)
    .where(eq(contract_comparison.id, comparisonId));
};

export const getContractComparisonFiles = async (comparisonId: string) => {
  return await db
    .select()
    .from(contract_comparison_files)
    .where(eq(contract_comparison_files.contractComparisonId, comparisonId))
    .orderBy(desc(contract_comparison_files.createdAt));
};

export const deleteContractComparisonFile = async (
  vaultFileId: string,
  comparisonId: string
) => {
  console.log(vaultFileId, comparisonId);

  const locale = getLocaleFromCookies();
  await db
    .delete(contract_comparison_files)
    .where(
      eq(contract_comparison_files.vaultFileId, vaultFileId) &&
        eq(contract_comparison_files.contractComparisonId, comparisonId)
    );
  console.log("Deleting file");

  revalidatePath(`/${locale}/compare-contract/${comparisonId}`);
};

export const getContractComparisonMessages = async (comparisonId: string) => {
  return await db
    .select()
    .from(contract_comparison_messages)
    .where(
      eq(contract_comparison_messages.contract_comparison_id, comparisonId)
    )
    .orderBy(asc(contract_comparison_messages.createdAt));
};

export const saveContractComparisonMessage = async (
  comparisonId: string,
  role: string,
  message: string
) => {
  const locale = getLocaleFromCookies();
  const data = await db
    .insert(contract_comparison_messages)
    .values({
      content: message,
      contract_comparison_id: comparisonId,
      role,
    })
    .returning({ messageId: contract_comparison_messages.id });
  const messageId = data[0].messageId;
  revalidatePath(`/${locale}/compare-contract`);
  revalidatePath(`/${locale}/compare-contract/${comparisonId}`);
  return messageId;
};

export const saveContractComparisonFile = async ({
  comparisonId,
  fileId,
  fileName,
  fileType,
  fileSize,
  fileContent,
  storageUrl,
  vaultFileId,
}: {
  comparisonId: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileContent: string;
  storageUrl: string;
  vaultFileId: string;
}) => {
  const locale = getLocaleFromCookies();

  // Check if file already exists in this comparison
  const existingFiles = await db
    .select()
    .from(contract_comparison_files)
    .where(eq(contract_comparison_files.contractComparisonId, comparisonId));

  // Only allow two files per comparison
  if (existingFiles.length >= 2) {
    throw new Error("Only two files can be added to a comparison");
  }

  console.log("Adding file to comparison");

  // Add the file to the comparison
  await db.insert(contract_comparison_files).values({
    contractComparisonId: comparisonId,
    file_name: fileName,
    file_path: fileId,
    file_type: fileType,
    file_size: fileSize.toString(),
    file_content: fileContent,
    storageUrl: storageUrl,
    vaultFileId,
  });

  revalidatePath(`/${locale}/compare-contract/${comparisonId}`);
};

export const getVaultFileById = async (fileId: string) => {
  return await db
    .select()
    .from(vault_files)
    .where(eq(vault_files.id, fileId))
    .limit(1);
};
