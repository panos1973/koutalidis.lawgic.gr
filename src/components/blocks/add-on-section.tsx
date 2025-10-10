"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { AddOn, AddOnPackages, Subscription } from "@/lib/types/types";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Icons } from "../icons";

import { useUser } from "@clerk/nextjs";

// const addons = [
//   {
//     stripePriceId: "price_1R2ar44EzDhZiAb5XD0IUVsi",
//     name: "500 επιπλέον σελίδες",
//     price: 38,
//     type: "upload",
//     additionalFileUploadCount: 500,
//     additionalMessageCount: 0,
//     description:
//       "Αυξήστε το όριο των σελίδων που μπορείτε να ανεβάσετε στον λογαριασμό σας",
//     isActive: true,
//   },
//   {
//     stripePriceId: "price_1R2aqq4EzDhZiAb5UWhQpnwr",
//     name: "200 επιπλέον σελίδες",
//     price: 16,
//     type: "upload",
//     additionalFileUploadCount: 200,
//     additionalMessageCount: 0,
//     description:
//       "Αυξήστε το όριο των σελίδων που μπορείτε να ανεβάσετε στον λογαριασμό σας",
//     isActive: true,
//   },
//   {
//     stripePriceId: "price_1R2apn4EzDhZiAb5l2H6TqwA",
//     name: "100 επιπλέον σελίδες",
//     price: 9.5,
//     type: "upload",
//     additionalFileUploadCount: 100,
//     additionalMessageCount: 0,
//     description:
//       "Αυξήστε το όριο των σελίδων που μπορείτε να ανεβάσετε στον λογαριασμό σας",
//     isActive: true,
//   },
//   {
//     stripePriceId: "price_1R2apV4EzDhZiAb5Ad3wyIm0",
//     name: "50 επιπλέον σελίδες",
//     price: 9.5,
//     type: "upload",
//     additionalFileUploadCount: 50,
//     additionalMessageCount: 0,
//     description:
//       "Αυξήστε το όριο των σελίδων που μπορείτε να ανεβάσετε στον λογαριασμό σας",
//     isActive: true,
//   },
//   {
//     stripePriceId: "price_1R2aiI4EzDhZiAb5abqAY12G",
//     name: "50 επιπλέον ερωτήσεις",
//     price: 33,
//     type: "message",
//     additionalFileUploadCount: 0,
//     additionalMessageCount: 50,
//     description: "50 επιπλέον ερωτήσεις για τον λογαριασμό σας",
//     isActive: true,
//   },
//   {
//     stripePriceId: "price_1R2ahY4EzDhZiAb5VQLzPVCE",
//     name: "30 επιπλέον ερωτήσεις",
//     price: 19,
//     type: "message",
//     additionalFileUploadCount: 0,
//     additionalMessageCount: 30,
//     description: "30 επιπλέον ερωτήσεις για τον λογαριασμό σας",
//     isActive: true,
//   },
//   {
//     stripePriceId: "price_1R2ac34EzDhZiAb5ER6vR8t2",
//     name: "15 επιπλέον ερωτήσεις",
//     price: 10,
//     type: "message",
//     additionalFileUploadCount: 0,
//     additionalMessageCount: 15,
//     description: "15 επιπλέον ερωτήσεις για τον λογαριασμό σας",
//     isActive: true,
//   },
// ];

interface AddOnSectionProps {
  addOns: AddOnPackages[];
  className?: string;
  currentSubscription?: Subscription | null;
}

function AddOnSection({
  addOns,
  className,
  currentSubscription,
}: AddOnSectionProps) {
  const locale = useLocale();
  const router = useRouter();
  const { user } = useUser();

  const [loadingAddOnId, setLoadingAddOnId] = useState<string | null>(null);

  const buttonStyles = {
    default: cn(
      "h-10 bg-white dark:bg-zinc-900",
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

  const purchaseAddOn = async (
    addOnId: string,
    addOnName: string,
    quantity: number = 1
  ) => {
    if (!currentSubscription) {
      toast.error("You need an active subscription to purchase add-ons");
      return;
    }

    try {
      setLoadingAddOnId(addOnId);
    } catch (e) {
      toast.error("Something went wrong. Please try again later.");
    } finally {
      setLoadingAddOnId(null);
    }
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
      <div className="w-full px-8 mx-auto">
        <div className="flex flex-col items-center gap-4 mb-12">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Add-Ons & Extensions 🚀
          </h2>
          <p className="text-center text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Enhance your subscription with these one-time purchases that add
            extra capacity to your plan.
          </p>
        </div>

        {/* Group add-ons by type */}
        {["messages", "storage"].map((category) => {
          const categoryAddOns = addOns
            .filter((addOn) => addOn.type === category)
            .sort((a, b) => a.price - b.price);
          if (categoryAddOns.length === 0) return null;

          return (
            <div key={category} className="mb-12">
              <h3 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6 capitalize">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {categoryAddOns.map((addOn) => {
                  return (
                    <div
                      key={addOn.name}
                      className={cn(
                        "relative group backdrop-blur-sm",
                        "rounded-3xl transition-all duration-300",
                        "flex flex-col",
                        "bg-white dark:bg-zinc-800/50",
                        "border border-zinc-200 dark:border-zinc-700 shadow-md",
                        "hover:translate-y-0 hover:shadow-lg"
                      )}
                    >
                      <div className="p-6 flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <div
                            className={cn(
                              "p-3 rounded-xl",
                              "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                            )}
                          >
                            {addOn.icon}
                          </div>
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {addOn.name}
                          </h3>
                        </div>

                        <div className="mb-6">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                              €{addOn.price}
                            </span>
                            <span className="text-sm text-zinc-500 dark:text-zinc-400">
                              /one-time
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                            {addOn.description}
                          </p>
                        </div>

                        <div className="space-y-4">
                          {addOn.type === "messages" && (
                            <div className="flex gap-4">
                              <div className="mt-1 p-0.5 rounded-full transition-colors duration-200 text-emerald-600 dark:text-emerald-400">
                                <CheckIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                  {addOn.additionalMessageCount} Additional
                                  Messages
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Ask more questions with your subscription
                                </div>
                              </div>
                            </div>
                          )}

                          {addOn.type === "storage" && (
                            <div className="flex gap-4">
                              <div className="mt-1 p-0.5 rounded-full transition-colors duration-200 text-emerald-600 dark:text-emerald-400">
                                <CheckIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                  {addOn.additionalFileUploadCount} Additional
                                  Pages
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Upload more documents with your subscription
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-4">
                            <div className="mt-1 p-0.5 rounded-full transition-colors duration-200 text-emerald-600 dark:text-emerald-400">
                              <CheckIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                                Valid for 6 Months
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Use your additional capacity within 6 months
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 pt-0 mt-auto">
                        <Button
                          disabled={
                            !currentSubscription || loadingAddOnId === addOn.id
                          }
                          className={cn(
                            "w-full relative transition-all duration-300",
                            buttonStyles.default,
                            !currentSubscription
                              ? "opacity-70 cursor-not-allowed"
                              : ""
                          )}
                          onClick={() => purchaseAddOn(addOn.id, addOn.name)}
                        >
                          <span className="relative text-xs z-10 flex items-center justify-center gap-2">
                            {loadingAddOnId === addOn.id ? (
                              <>
                                <Icons.spinner className="animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                Purchase
                                <ArrowRightIcon className="w-4 h-4" />
                              </>
                            )}
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { AddOnSection };
