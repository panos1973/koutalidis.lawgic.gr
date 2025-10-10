"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { Subscription } from "@/lib/types/types";
import { toast } from "sonner";
import { subscribeToFreeTier } from "@/app/[locale]/actions/subscription";

import { useLocale } from "next-intl";
import { Icons } from "../icons";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface Feature {
  name: string;
  description: string;
  included: boolean;
}

export interface PricingTier {
  id: string;
  name: string;
  price: {
    monthly: number;
    yearly: number;
  };
  description: string;
  features: Feature[];
  highlight?: boolean;
  badge?: string;
  icon: React.ReactNode;
  stripePriceIds?: {
    monthly: string;
    yearly: string;
  };
  feature_limits: {};
}

interface PricingSectionProps {
  tiers: PricingTier[];
  className?: string;
  currentSubscription?: Subscription | null;
}

function PricingSection({
  tiers,
  className,
  currentSubscription,
}: PricingSectionProps) {
  const locale = useLocale();
  const router = useRouter();
  const { user } = useUser();

  const [loadingTierId, setLoadingTierId] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);

  const buttonStyles = {
    default: cn(
      "h-12 bg-white dark:bg-zinc-900",
      "hover:bg-zinc-50 dark:hover:bg-zinc-800",
      "text-zinc-900 dark:text-zinc-100",
      "border border-zinc-200 dark:border-zinc-800",
      "hover:border-zinc-300 dark:hover:border-zinc-700",
      "shadow-sm hover:shadow-md",
      "text-sm font-medium"
    ),
    highlight: cn(
      "h-12 bg-zinc-900 dark:bg-zinc-100",
      "hover:bg-zinc-800 dark:hover:bg-zinc-300",
      "text-white dark:text-zinc-900",
      "shadow-[0_1px_15px_rgba(0,0,0,0.1)]",
      "hover:shadow-[0_1px_20px_rgba(0,0,0,0.15)]",
      "font-semibold text-base"
    ),
  };

  const subscribeToPlan = async (
    planId: string,
    plan: string,
    priceId: string,
    interval: string
  ) => {
    console.log("Subscribing to plan:");
    console.log(plan);

    if (currentSubscription && currentSubscription.planId === planId) {
      toast.warning(`You're already subscribed to ${plan} plan`);
      return;
    }

    console.log("Navigating to organization creation page...");

    // Redirect to organization creation page with selected plan ID
    router.push(`/${locale}/organization/create?planId=${planId}`);
    // return;

    // Commented out the original subscription flow as we're now redirecting to org creation
    /*
    if (plan === "Free") {
      toast.promise(subscribeToFreeTier(planId, interval), {
        success: () => {
          router.push(`/${locale}/account`);
          setLoadingTierId(null);
          return "You've successfully subscribed to the Free plan";
        },
        error: "Something went wrong. Please try again later.",
        loading: "Subscribing to the Free plan...",
      });
      return;
    } else {
      try {
        setLoadingTierId(planId);
        let stripeCustomerId = currentSubscription?.stripeCustomerId ?? null;

        if (!stripeCustomerId) {
          if (!user) return;
          const customer = await createStripeCustomer(user.id);
          stripeCustomerId = customer.id;
        }

        const response = await fetch(`/${locale}/api/stripe/create-checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "subscription",
            planId: planId,
            paymentInterval: isYearly ? "yearly" : "monthly",
            customerId: stripeCustomerId,
            successUrl: `${window.location.origin}/${locale}/account`,
            cancelUrl: `${window.location.origin}/${locale}/plans`,
          }),
        });

        const { url } = await response.json();
        router.push(url);
      } catch (e) {
        toast.error("Something went wrong. Please try again later.");
      } finally {
        setLoadingTierId(null);
      }
    }
    */
  };

  const badgeStyles = cn(
    "px-4 py-1.5 text-sm font-medium",
    "bg-zinc-900 dark:bg-zinc-100",
    "text-white dark:text-zinc-900 text-xs",
    "border-none shadow-lg"
  );

  return (
    <section
      className={cn(
        "relative bg-background text-foreground",
        "py-4 px-4 md:py-6 lg:py-12",
        "overflow-scroll",
        "max-h-[93svh]",
        className
      )}
    >
      <div className="w-full px-8  mx-auto">
        <div className="flex flex-col items-center gap-4 mb-12">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Simple and Flexible Pricing For Your Organisation 🔥
          </h2>
          <div className="inline-flex items-center p-1.5 bg-white dark:bg-zinc-800/50 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm">
            {["Monthly", "Yearly"].map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Yearly")}
                className={cn(
                  "px-8 py-2.5 text-xs font-medium rounded-full transition-all duration-300",
                  (period === "Yearly") === isYearly
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                {period}{" "}
                <span className=" bg-gradient-to-b from-yellow-200 via-orange-500 to-red-600 bg-clip-text text-transparent">
                  {period === "Yearly" && "One Month Free 🎉"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {tiers.map((tier) => {
            const isCurrentPlan =
              currentSubscription && currentSubscription.planId === tier.id;
            return (
              <div
                key={tier.name}
                className={cn(
                  "relative group backdrop-blur-sm",
                  "rounded-3xl transition-all duration-300",
                  "flex flex-col",
                  tier.highlight
                    ? "bg-gradient-to-b from-zinc-100/80 to-transparent dark:from-zinc-400/[0.15]"
                    : "bg-white dark:bg-zinc-800/50",
                  "border",
                  tier.highlight
                    ? "border-zinc-400/50 dark:border-zinc-400/20 shadow-xl"
                    : "border-zinc-200 dark:border-zinc-700 shadow-md",
                  "hover:translate-y-0 hover:shadow-lg",
                  isCurrentPlan
                    ? "ring-2 ring-emerald-500 dark:ring-emerald-400"
                    : ""
                )}
              >
                {tier.badge && tier.highlight && (
                  <div className="absolute -top-4 left-6">
                    <Badge className={badgeStyles}>{tier.badge}</Badge>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 right-6">
                    <Badge
                      className={cn(
                        badgeStyles,
                        "bg-emerald-500 dark:bg-emerald-600"
                      )}
                    >
                      Current Plan
                    </Badge>
                  </div>
                )}

                <div className="p-8 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={cn(
                        "p-3 rounded-xl",
                        tier.highlight
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      )}
                    >
                      {tier.icon}
                    </div>
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {tier.name}
                    </h3>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        €{isYearly ? tier.price.yearly : tier.price.monthly}
                      </span>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        /{isYearly ? "year" : "month"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {tier.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {tier.features.map((feature) => (
                      <div key={feature.name} className="flex gap-4">
                        <div
                          className={cn(
                            "mt-1 p-0.5 rounded-full transition-colors duration-200",
                            feature.included
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-zinc-400 dark:text-zinc-600"
                          )}
                        >
                          <CheckIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {feature.name}
                          </div>
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            {feature.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 pt-0 mt-auto">
                  <Link
                    href={`/${locale}/organization/create?planId=${
                      tier.id
                    }&interval=${isYearly ? "yearly" : "monthly"}`}
                  >
                    <Button
                      disabled={isCurrentPlan || loadingTierId === tier.id}
                      className={cn(
                        "w-full relative transition-all duration-300",
                        tier.highlight
                          ? buttonStyles.highlight
                          : buttonStyles.default,
                        isCurrentPlan ? "opacity-70 cursor-not-allowed" : ""
                      )}
                    >
                      <span className="relative text-sm z-10 flex items-center justify-center gap-2">
                        {loadingTierId === tier.id ? (
                          <>
                            <Icons.spinner className="animate-spin" />
                            Loading...
                          </>
                        ) : isCurrentPlan ? (
                          "Current Plan"
                        ) : tier.highlight ? (
                          <>
                            Buy now
                            <ArrowRightIcon className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Get started
                            <ArrowRightIcon className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { PricingSection };
