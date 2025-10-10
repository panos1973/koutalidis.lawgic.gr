"use server";

import db from "@/db/drizzle";
import {
  addOns,
  plans,
  subscriptions,
  usage,
  usageLogs,
  userAddOns,
} from "@/db/schema";

import { currentUser, auth } from "@clerk/nextjs/server";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { eq, and, gte, lte, or, isNull, gt } from "drizzle-orm";

export const getCurrentSubscription = async () => {
  const { userId, sessionClaims } = auth();
  if (!userId) {
    return null;
  }
  //@ts-ignore
  const orgId = (sessionClaims?.o?.id as string) || userId;
  console.log("orgId from sub: ", orgId);

  const subscription = await db.query.subscriptions.findFirst({
    where: (subscriptions, { eq }) => eq(subscriptions.clerkUserId, userId),
  });
  return subscription;
};

export const subscribeToFreeTier = async (
  planId: string,
  paymentInterval: string
) => {
  const locale = await getLocale();
  const { userId, sessionClaims } = auth();

  if (!userId) {
    redirect(`/${locale}/sign-in`);
  }

  // Get organization ID from session claims if available, otherwise use user ID
  //@ts-ignore
  const orgId = (sessionClaims?.o?.id as string) || userId;

  try {
    // Get user details for email
    const user = await currentUser();
    if (!user) {
      redirect(`/${locale}/sign-in`);
    }

    const client = clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: {
        plan: "Free",
        planId,
        subscription: "active",
      },
    });

    await db.insert(subscriptions).values({
      organizationId: orgId,
      planId: planId,
      status: "active",
      clerkUserId: user.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(new Date().setDate(new Date().getDate() + 5)),
      cancelAtPeriodEnd: true,
      paymentInterval,
      metadata: {},
    });
    revalidatePath(`/${locale}/plans`);
    // redirect(`/en/account`);
  } catch (error: any) {
    console.error(error);
    throw new Error(`Failed to subscribe to free tier: ${error.message}`);
  }
};

/**
 * Gets all active add-ons for a subscription
 * @param subscriptionId The ID of the subscription
 * @returns Array of active add-ons with their quantities
 */
export async function getActiveAddOns(subscriptionId: string) {
  const now = new Date();

  const activeAddOns = await db
    .select({
      id: userAddOns.id,
      addOn: {
        id: addOns.id,
        // name: addOns.name,
        // type: addOns.type,
        additionalMessageCount: addOns.additionalMessageCount,
        additionalFileUploadCount: addOns.additionalFileUploadCount,
        // price: addOns.price,
      },
      quantity: userAddOns.quantity,
      expiresAt: userAddOns.expiresAt,
    })
    .from(userAddOns)
    .innerJoin(addOns, eq(userAddOns.addOnId, addOns.id))
    .where(
      and(
        eq(userAddOns.subscriptionId, subscriptionId),
        // eq(addOns.isActive, true),
        or(isNull(userAddOns.expiresAt), gt(userAddOns.expiresAt, now))
      )
    );

  return activeAddOns;
}

/**
 * Calculate total additional limits from add-ons
 * @param subscriptionId The ID of the subscription
 * @returns Object containing additional messages and upload capacity
 */
export async function calculateAddOnLimits(subscriptionId: string) {
  const activeAddOns = await getActiveAddOns(subscriptionId);

  const additionalLimits = activeAddOns.reduce(
    (totals, item) => {
      return {
        messages:
          totals.messages + item.addOn.additionalMessageCount! * item.quantity,
        uploads:
          totals.uploads +
          item.addOn.additionalFileUploadCount! * item.quantity,
      };
    },
    { messages: 0, uploads: 0 }
  );

  return additionalLimits;
}

/**
 * Gets a subscription with its plan, add-ons and current cycle usage
 * @returns The subscription with plan, add-ons, usage and usage metrics for progress bars
 */
export async function getSubscriptionWithCurrentUsage() {
  // If organizationId is not provided, get it from the session claims
  const { userId, sessionClaims } = auth();

  // if (!organizationId) {
  //   if (!userId) {
  //     console.log("User not authenticated");
  //     return;
  //   }
  //   // Use organization ID from session claims if available, otherwise use user ID
  //   //@ts-ignore
  //   organizationId = (sessionClaims?.o?.id as string) || userId;
  // }
  if (!userId) {
    console.log("User not authenticated");
    return;
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clerkUserId, userId))
    .limit(1);

  if (!sub) {
    console.log("Subscription not found");
    return;
  }

  // Get the subscription with its plan
  const [subscriptionData] = await db
    .select({
      // Subscription fields
      id: subscriptions.id,
      clerkUserId: subscriptions.clerkUserId,
      planId: subscriptions.planId,
      paymentInterval: subscriptions.paymentInterval,
      status: subscriptions.status,
      currentPeriodStart: subscriptions.currentPeriodStart,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      metadata: subscriptions.metadata,
      createdAt: subscriptions.createdAt,
      updatedAt: subscriptions.updatedAt,

      // Plan fields
      plan: {
        id: plans.id,

        monthlyMessageLimit: plans.monthlyMessageLimit,
        monthlyFileUploadLimit: plans.monthlyFileUploadLimit,

        createdAt: plans.createdAt,
        updatedAt: plans.updatedAt,
      },
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.id, sub.id))
    .limit(1);

  if (!subscriptionData) {
    throw new Error("Subscription not found");
  }

  // Get usage data for the current billing cycle
  const currentUsage = await db
    .select()
    .from(usage)
    .where(
      and(
        eq(usage.subscriptionId, sub.id),
        gte(usage.periodEnd, subscriptionData.currentPeriodStart),
        lte(usage.periodStart, subscriptionData.currentPeriodEnd)
      )
    )
    .orderBy(usage.periodStart);

  // Get active add-ons and their additional limits
  const addOnLimits = await calculateAddOnLimits(sub.id);
  const activeAddOns = await getActiveAddOns(sub.id);

  // Calculate total usage for current period
  const totalMessagesSent = currentUsage.reduce(
    (sum, record) => sum + record.messagesSent,
    0
  );
  const totalPagesUploaded = currentUsage.reduce(
    (sum, record) => sum + record.pagesUploaded,
    0
  );

  // Calculate total limits including add-ons
  const totalMessageLimit =
    subscriptionData.plan!.monthlyMessageLimit + addOnLimits.messages;
  const totalUploadLimit =
    subscriptionData.plan!.monthlyFileUploadLimit + addOnLimits.uploads;

  // Calculate usage percentages for progress bars
  const messagesLimitPercentage = Math.min(
    100,
    (totalMessagesSent / totalMessageLimit) * 100
  );

  const uploadsLimitPercentage = Math.min(
    100,
    (totalPagesUploaded / totalUploadLimit) * 100
  );

  // Return subscription with plan, add-ons, usage and progress metrics
  return {
    subscription: subscriptionData,
    currentUsage,
    activeAddOns,
    usageMetrics: {
      messages: {
        used: totalMessagesSent,
        baseLimit: subscriptionData.plan!.monthlyMessageLimit,
        addOnBonus: addOnLimits.messages,
        totalLimit: totalMessageLimit,
        percentage: Number(messagesLimitPercentage.toFixed(1)),
        remaining: Math.max(0, totalMessageLimit - totalMessagesSent),
      },
      uploads: {
        used: totalPagesUploaded,
        baseLimit: subscriptionData.plan!.monthlyFileUploadLimit,
        addOnBonus: addOnLimits.uploads,
        totalLimit: totalUploadLimit,
        percentage: Number(uploadsLimitPercentage.toFixed(1)),
        remaining: Math.max(0, totalUploadLimit - totalPagesUploaded),
      },
    },
  };
}

/**
 * Check if a user has reached their usage limits (including add-ons)
 * @returns Object with boolean flags indicating if limits are reached
 */
export async function checkUsageLimits() {
  const data = await getSubscriptionWithCurrentUsage();

  if (!data) {
    return {
      active_subscription: false,
      subscriptionId: "",
      messageLimit: {
        isReached: false,
        used: 0,
        baseLimit: 0,
        addOnBonus: 0,
        totalLimit: 0,
        percentage: 0,
      },
      uploadLimit: {
        isReached: false,
        used: 0,
        baseLimit: 0,
        addOnBonus: 0,
        totalLimit: 0,
        percentage: 0,
      },
    };
  }

  return {
    active_subscription: data.subscription.status === "active",
    subscriptionId: data.subscription.id,
    messageLimit: {
      isReached:
        data.usageMetrics.messages.used >=
        data.usageMetrics.messages.totalLimit,
      used: data.usageMetrics.messages.used,
      baseLimit: data.usageMetrics.messages.baseLimit,
      addOnBonus: data.usageMetrics.messages.addOnBonus,
      totalLimit: data.usageMetrics.messages.totalLimit,
      percentage: Number(data.usageMetrics.messages.percentage.toFixed(0)),
    },
    uploadLimit: {
      isReached:
        data.usageMetrics.uploads.used >= data.usageMetrics.uploads.totalLimit,
      used: data.usageMetrics.uploads.used,
      baseLimit: data.usageMetrics.uploads.baseLimit,
      addOnBonus: data.usageMetrics.uploads.addOnBonus,
      totalLimit: data.usageMetrics.uploads.totalLimit,
      percentage: Number(data.usageMetrics.uploads.percentage.toFixed(0)),
    },
  };
}

/**
 * Add an add-on to a user's subscription
 * @param subscriptionId The ID of the subscription
 * @param addOnId The ID of the add-on to add
 * @param quantity Number of add-on units to add (defaults to 1)
 * @param expiresAt Optional expiration date for the add-on
 * @returns The created user add-on record
 */
export async function addAddOnToSubscription(
  subscriptionId: string,
  addOnId: string,
  quantity: number = 1,
  expiresAt?: Date
) {
  // Verify add-on exists and is active
  const [addOnItem] = await db
    .select()
    .from(addOns)
    .where(and(eq(addOns.id, addOnId)));

  if (!addOnItem) {
    throw new Error("Add-on not found or is inactive");
  }

  // Add the add-on to the user's subscription
  const [userAddOn] = await db
    .insert(userAddOns)
    .values({
      subscriptionId,
      addOnId,
      quantity,
      expiresAt,
    })
    .returning();

  return userAddOn;
}

/**
 * Update existing user add-on (change quantity or expiration)
 * @param userAddOnId The ID of the user add-on to update
 * @param quantity New quantity (optional)
 * @param expiresAt New expiration date (optional)
 * @returns The updated user add-on record
 */
export async function updateUserAddOn(
  userAddOnId: string,
  quantity?: number,
  expiresAt?: Date | null
) {
  const updateData: Partial<typeof userAddOns.$inferInsert> = {};

  if (quantity !== undefined) {
    updateData.quantity = quantity;
  }

  if (expiresAt !== undefined) {
    updateData.expiresAt = expiresAt;
  }

  updateData.updatedAt = new Date();

  const [updatedUserAddOn] = await db
    .update(userAddOns)
    .set(updateData)
    .where(eq(userAddOns.id, userAddOnId))
    .returning();

  return updatedUserAddOn;
}

//   /**
//    * Remove an add-on from a user's subscription
//    * @param userAddOnId The ID of the user add-on to remove
//    * @returns Boolean indicating success
//    */
//   export async function removeUserAddOn(userAddOnId: string) {
// 	const result = await db
// 	  .delete(userAddOns)
// 	  .where(eq(userAddOns.id, userAddOnId));

// 	return result.rowCount > 0;
//   }

/**
 * Record message usage for a subscription
 * @param subscriptionId The ID of the subscription
 * @param messageCount Number of messages to record (defaults to 1)
 * @param metadata Optional metadata about the message
 * @returns The updated usage record
 */
export async function recordMessageUsage(
  subscriptionId: string,
  messageCount: number = 1,
  metadata: Record<string, any> = {},
  userId?: string
) {
  // Begin transaction to ensure data consistency
  return await db.transaction(async (tx) => {
    // Get subscription to find current period
    const subscription = await tx
      .select({
        id: subscriptions.id,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription[0]) {
      throw new Error("Subscription not found");
    }

    const { currentPeriodStart, currentPeriodEnd } = subscription[0];

    // Find or create usage record for current period
    const currentUsage = await tx
      .select()
      .from(usage)
      .where(
        and(
          eq(usage.subscriptionId, subscriptionId),
          gte(usage.periodEnd, currentPeriodStart),
          lte(usage.periodStart, currentPeriodEnd)
        )
      )
      .limit(1);

    let usageRecord;

    if (currentUsage.length === 0) {
      // Create new usage record if none exists for current period
      const [newUsage] = await tx
        .insert(usage)
        .values({
          subscriptionId,
          periodStart: currentPeriodStart,
          periodEnd: currentPeriodEnd,
          messagesSent: messageCount,
          pagesUploaded: 0,
        })
        .returning();

      usageRecord = newUsage;
    } else {
      // Update existing usage record
      const [updatedUsage] = await tx
        .update(usage)
        .set({
          messagesSent: currentUsage[0].messagesSent + messageCount,
          updatedAt: new Date(),
        })
        .where(eq(usage.id, currentUsage[0].id))
        .returning();

      usageRecord = updatedUsage;
    }

    // Get current user if userId not provided
    if (!userId) {
      const { userId: authUserId } = auth();
      userId = authUserId!;
    }

    // Create usage log entry for detailed tracking
    await tx.insert(usageLogs).values({
      subscriptionId,
      userId,
      type: "messages",
      metadata: {
        count: messageCount,
        ...metadata,
      },
    });

    return usageRecord;
  });
}

/**
 * Record file upload usage for a subscription
 * @param subscriptionId The ID of the subscription
 * @param pageCount Number of pages in the uploaded file(s)
 * @param metadata Optional metadata about the upload
 * @returns The updated usage record
 */
export async function recordFileUploadUsage(
  subscriptionId: string,
  pageCount: number = 1,
  pathToRevalidate: string,
  metadata: Record<string, any> = {},
  userId?: string
) {
  // Begin transaction to ensure data consistency
  return await db.transaction(async (tx) => {
    // Get subscription to find current period
    const subscription = await tx
      .select({
        id: subscriptions.id,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription[0]) {
      throw new Error("Subscription not found");
    }

    const { currentPeriodStart, currentPeriodEnd } = subscription[0];

    // Find or create usage record for current period
    const currentUsage = await tx
      .select()
      .from(usage)
      .where(
        and(
          eq(usage.subscriptionId, subscriptionId),
          gte(usage.periodEnd, currentPeriodStart),
          lte(usage.periodStart, currentPeriodEnd)
        )
      )
      .limit(1);

    let usageRecord;

    if (currentUsage.length === 0) {
      // Create new usage record if none exists for current period
      const [newUsage] = await tx
        .insert(usage)
        .values({
          subscriptionId,
          periodStart: currentPeriodStart,
          periodEnd: currentPeriodEnd,
          messagesSent: 0,
          pagesUploaded: pageCount,
        })
        .returning();

      usageRecord = newUsage;
    } else {
      // Update existing usage record
      const [updatedUsage] = await tx
        .update(usage)
        .set({
          pagesUploaded: currentUsage[0].pagesUploaded + pageCount,
          updatedAt: new Date(),
        })
        .where(eq(usage.id, currentUsage[0].id))
        .returning();

      usageRecord = updatedUsage;
    }

    // Get current user if userId not provided
    if (!userId) {
      const { userId: authUserId } = auth();
      userId = authUserId!;
    }

    // Create usage log entry for detailed tracking
    await tx.insert(usageLogs).values({
      subscriptionId,
      userId,
      type: "storage",
      metadata: {
        pageCount,
        ...metadata,
      },
    });
    // revalidatePath(`/${getLocale()}`, "layout");  // Commented out to fix infinite loop
    revalidatePath(`/${getLocale()}/${pathToRevalidate}`);
    return usageRecord;
  });
}

/**
 * Check if a user has reached their usage limits
 * @param subscriptionId The ID of the subscription to check
 * @returns Object with boolean flags indicating if limits are reached
 */
// export async function checkUsageLimits() {
//   const data = await getSubscriptionWithCurrentUsage();

//   if (!data) {
//     return {
//       active_subscription: false,
//       messageLimit: {
//         isReached: false,
//         used: 0,
//         limit: 0,
//         percentage: 0,
//       },
//       uploadLimit: {
//         isReached: false,
//         used: 0,
//         limit: 0,
//         percentage: 0,
//       },
//     };
//   }

//   return {
//     active_subscription: data.subscription.status === "active",
//     messageLimit: {
//       isReached:
//         data.usageMetrics.messages.used >= data.usageMetrics.messages.limit,
//       used: data.usageMetrics.messages.used,
//       limit: data.usageMetrics.messages.limit,
//       percentage: data.usageMetrics.messages.percentage,
//     },
//     uploadLimit: {
//       isReached:
//         data.usageMetrics.uploads.used >= data.usageMetrics.uploads.limit,
//       used: data.usageMetrics.uploads.used,
//       limit: data.usageMetrics.uploads.limit,
//       percentage: data.usageMetrics.uploads.percentage,
//     },
//   };
// }
