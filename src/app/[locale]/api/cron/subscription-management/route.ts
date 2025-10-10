import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import db from "@/db/drizzle";
import {
  subscriptions,
  userAddOns,
  usage,
  plans,
  addOns,
  subscriptionStatusEnum,
} from "@/db/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";

// Vercel cron job API route
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel cron or contains the correct auth header
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // console.log('Starting subscription management cron job...');

    const results = {
      subscriptionsUpdated: 0,
      limitsReset: 0,
      addOnsRenewed: 0,
      addOnsExpired: 0,
      errors: [] as string[],
    };

    // Get all subscriptions that need processing (active and potentially expired)
    const allSubscriptions = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        sql`${subscriptions.status} IN ('active', 'past_due') OR (${subscriptions.status} = 'expired' AND ${subscriptions.currentPeriodEnd} >= NOW() - INTERVAL '7 days')`
      );

    console.log(`Found ${allSubscriptions.length} subscriptions to process`);

    // Process each subscription
    for (const subscriptionData of allSubscriptions) {
      try {
        await processUserSubscription(
          subscriptionData.subscription.clerkUserId,
          results,
          subscriptionData
        );
      } catch (error) {
        console.error(
          `Error processing subscription ${subscriptionData.subscription.id}:`,
          error
        );
        results.errors.push(
          `Subscription ${subscriptionData.subscription.id}: ${error}`
        );
      }
    }

    // Check and renew add-ons
    await processAddOnRenewals(results);

    // Check and expire add-ons
    await processAddOnExpirations(results);

    console.log("Cron job completed:", results);
    return NextResponse.json({
      success: true,
      message: "Subscription management completed",
      results,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function processUserSubscription(
  userId: string,
  results: any,
  subscriptionData?: any
) {
  // Use provided subscription data or fetch from database
  let userSubscription;

  if (subscriptionData) {
    userSubscription = subscriptionData;
  } else {
    const userSubscriptions = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.clerkUserId, userId));

    if (userSubscriptions.length === 0) {
      console.log(`No subscription found for user ${userId}`);
      return;
    }

    userSubscription = userSubscriptions[0];
  }
  const currentDate = new Date();

  // Check if subscription period has ended
  const periodEnd = new Date(userSubscription.subscription.currentPeriodEnd);
  const shouldResetLimits = currentDate >= periodEnd;

  if (shouldResetLimits) {
    console.log(`Resetting limits for user ${userId}`);

    // Calculate new period dates
    const newPeriodStart = new Date(currentDate);
    const newPeriodEnd = new Date(currentDate);

    // Add billing interval to period end
    if (userSubscription.subscription.paymentInterval === "monthly") {
      newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    } else if (userSubscription.subscription.paymentInterval === "yearly") {
      newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
    }

    // Update subscription period
    await db
      .update(subscriptions)
      .set({
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        updatedAt: currentDate,
      })
      .where(eq(subscriptions.id, userSubscription.subscription.id));

    // Reset usage for the new period
    await db
      .insert(usage)
      .values({
        subscriptionId: userSubscription.subscription.id,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
        messagesSent: 0,
        pagesUploaded: 0,
        createdAt: currentDate,
        updatedAt: currentDate,
      })
      .onConflictDoUpdate({
        target: [usage.subscriptionId, usage.periodStart],
        set: {
          messagesSent: 0,
          pagesUploaded: 0,
          updatedAt: currentDate,
        },
      });

    results.subscriptionsUpdated++;
    results.limitsReset++;
  }

  // Check subscription status and update if needed
  const subscriptionStatus = userSubscription.subscription.status;
  if (currentDate > periodEnd && subscriptionStatus === "active") {
    // Mark as expired if past due and no payment
    await db
      .update(subscriptions)
      .set({
        status: "expired",
        updatedAt: currentDate,
      })
      .where(eq(subscriptions.id, userSubscription.subscription.id));

    console.log(`Subscription expired for user ${userId}`);
  }
}

async function processAddOnRenewals(results: any) {
  const currentDate = new Date();

  // Find add-ons that need renewal (auto-renewal enabled and renewal date has passed)
  const addOnsToRenew = await db
    .select({
      userAddOn: userAddOns,
      addOn: addOns,
      subscription: subscriptions,
    })
    .from(userAddOns)
    .leftJoin(addOns, eq(userAddOns.addOnId, addOns.id))
    .leftJoin(subscriptions, eq(userAddOns.subscriptionId, subscriptions.id))
    .where(
      and(
        eq(userAddOns.autoRenewal, true),
        eq(userAddOns.isActive, true),
        lte(userAddOns.renewalDate, currentDate)
      )
    );

  for (const item of addOnsToRenew) {
    try {
      const { userAddOn, addOn, subscription } = item;

      if (!userAddOn || !addOn || !subscription) continue;

      // Calculate next renewal date
      const nextRenewalDate = new Date(userAddOn.renewalDate!);
      if (userAddOn.renewalInterval === "monthly") {
        nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
      } else if (userAddOn.renewalInterval === "yearly") {
        nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
      }

      // Calculate new expiration date
      const newExpirationDate = new Date(nextRenewalDate);
      if (userAddOn.renewalInterval === "monthly") {
        newExpirationDate.setMonth(newExpirationDate.getMonth() + 1);
      } else if (userAddOn.renewalInterval === "yearly") {
        newExpirationDate.setFullYear(newExpirationDate.getFullYear() + 1);
      }

      // Update the add-on with new renewal and expiration dates
      await db
        .update(userAddOns)
        .set({
          renewalDate: nextRenewalDate,
          expiresAt: newExpirationDate,
          lastRenewalDate: currentDate,
          updatedAt: currentDate,
        })
        .where(eq(userAddOns.id, userAddOn.id));

      console.log(
        `Renewed add-on ${addOn.id} for subscription ${subscription.id}`
      );
      results.addOnsRenewed++;
    } catch (error) {
      console.error("Error renewing add-on:", error);
      results.errors.push(`Add-on renewal error: ${error}`);
    }
  }
}

async function processAddOnExpirations(results: any) {
  const currentDate = new Date();

  // Find expired add-ons that are still active
  const expiredAddOns = await db
    .select({
      userAddOn: userAddOns,
      addOn: addOns,
      subscription: subscriptions,
    })
    .from(userAddOns)
    .leftJoin(addOns, eq(userAddOns.addOnId, addOns.id))
    .leftJoin(subscriptions, eq(userAddOns.subscriptionId, subscriptions.id))
    .where(
      and(
        eq(userAddOns.isActive, true),
        lte(userAddOns.expiresAt, currentDate),
        eq(userAddOns.autoRenewal, false) // Only expire non-auto-renewable add-ons
      )
    );

  for (const item of expiredAddOns) {
    try {
      const { userAddOn, addOn, subscription } = item;

      if (!userAddOn || !addOn || !subscription) continue;

      // Deactivate the expired add-on
      await db
        .update(userAddOns)
        .set({
          isActive: false,
          updatedAt: currentDate,
        })
        .where(eq(userAddOns.id, userAddOn.id));

      console.log(
        `Expired add-on ${addOn.id} for subscription ${subscription.id}`
      );
      results.addOnsExpired++;
    } catch (error) {
      console.error("Error expiring add-on:", error);
      results.errors.push(`Add-on expiration error: ${error}`);
    }
  }
}

// POST method for manual testing
export async function POST(request: NextRequest) {
  // Allow manual triggering in development
  if (process.env.NODE_ENV === "development") {
    return GET(request);
  }

  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
