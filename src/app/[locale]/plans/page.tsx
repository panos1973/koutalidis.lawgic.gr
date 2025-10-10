import { Sparkles, Zap, ArrowDownToDot, Star, Sparkle } from "lucide-react";
import {
  PricingSection,
  PricingTier,
} from "@/components/blocks/pricing-section";

import { getAllPlans } from "../actions/plans";
import { getCurrentSubscription } from "../actions/subscription";

import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { checkPendingOrgApproval } from "../actions/organizations";
import { isPartOfOrg } from "@/lib/auth";
// const defaultTiers: PricingTier[] = [
//   {
//     name: "Free",
//     price: {
//       monthly: 0,
//       yearly: 0,
//     },
//     description: "Test the waters with 5 days of free access",
//     icon: (
//       <div className="relative">
//         <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
//         <Star className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
//       </div>
//     ),
//     features: [
//       {
//         name: "10 Questions",
//         description: "Ask up to 10 questions per month",
//         included: true,
//       },
//       {
//         name: "All Tools Access",
//         description: "Athens, Case Research, Vault and Contract Analysis",
//         included: true,
//       },
//       {
//         name: "3 Pages",
//         description: "Upload up to 3 pages per month",
//         included: true,
//       },
//     ],
//     feature_limits: {
//       questions: 10,
//       tools: ["Athens", "Case Research", "Vault", "Contract Analysis"],
//       pages: 3,
//     },
//   },
//   {
//     name: "Starter",
//     price: {
//       monthly: 21,
//       yearly: 231,
//     },
//     stripePriceIds: {
//       monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!,
//       yearly: process.env.STRIPE_STARTER_YEARLY_PRICE_ID!,
//     },
//     description: "Perfect for individuals and small projects",
//     icon: (
//       <div className="relative">
//         <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
//         <Zap className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
//       </div>
//     ),

//     features: [
//       {
//         name: "30 Questions",
//         description: "Ask up to 30 questions per month",
//         included: true,
//       },
//       {
//         name: "Access to all tools",
//         description: "Athens, Case Research, Vault and Contract Analysis",
//         included: true,
//       },
//       {
//         name: "100 Pages",
//         description: "Upload up to 100 pages per month",
//         included: true,
//       },
//     ],
//     feature_limits: {
//       questions: 30,
//       tools: ["Athens", "Case Research", "Vault", "Contract Analysis"],
//       pages: 100,
//     },
//   },
//   {
//     name: "Plus",
//     price: {
//       monthly: 39,
//       yearly: 429,
//     },
//     stripePriceIds: {
//       monthly: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID!,
//       yearly: process.env.STRIPE_PLUS_YEARLY_PRICE_ID!,
//     },
//     highlight: true,
//     badge: "Most Popular",
//     description: "More power for growing projects",
//     icon: (
//       <div className="relative">
//         <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
//         <Sparkle className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
//       </div>
//     ),
//     features: [
//       {
//         name: "60 Questions",
//         description: "Ask up to 60 questions per month",
//         included: true,
//       },
//       {
//         name: "All Tools Access",
//         description: "Athens, Case Research, Vault and Contract Analysis",
//         included: true,
//       },
//       {
//         name: "250 Pages",
//         description: "Upload up to 250 pages per month",
//         included: true,
//       },
//     ],
//     feature_limits: {
//       questions: 60,
//       tools: ["Athens", "Case Research", "Vault", "Contract Analysis"],
//       pages: 250,
//     },
//   },
//   {
//     name: "Pro",
//     price: {
//       monthly: 75,
//       yearly: 825,
//     },
//     description: "Advanced features for professionals",
//     stripePriceIds: {
//       monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
//       yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
//     },
//     icon: (
//       <div className="relative">
//         <ArrowDownToDot className="w-7 h-7 relative z-10" />
//       </div>
//     ),
//     features: [
//       {
//         name: "100 Questions",
//         description: "Ask up to 100 questions per month",
//         included: true,
//       },
//       {
//         name: "All Tools Access",
//         description: "Athens, Case Research, Vault and Contract Analysis",
//         included: true,
//       },
//       {
//         name: "500 Pages",
//         description: "Upload up to 500 pages per month",
//         included: true,
//       },
//     ],
//     feature_limits: {
//       questions: 100,
//       tools: ["Athens", "Case Research", "Vault", "Contract Analysis"],
//       pages: 500,
//     },
//   },
// ];

const getIconNameByType = (type: string): React.ReactElement => {
  switch (type) {
    case "free":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
          <Star className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
        </div>
      );

    case "starter":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
          <Zap className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
        </div>
      );
    case "plus":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
          <Sparkle className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
        </div>
      );
    case "pro":
      return (
        <div className="relative">
          <ArrowDownToDot className="w-7 h-7 relative z-10" />
        </div>
      );
    default:
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
          <Star className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
        </div>
      );
  }
};

const Plans = async () => {
  const isPart = await isPartOfOrg();
  // const plans = await getAllPlans();
  // const locale = await getLocale();
  // const { hasPendingApproval } = await checkPendingOrgApproval();

  // if (hasPendingApproval) {
  //   redirect(`/${locale}/organizations/waiting`);
  // }
  // console.log(plans);

  // const currentSubscription = await getCurrentSubscription();

  // const finalPlans = plans.map((plan) => {
  //   // Extract features from the JSONB column
  //   const featuresData = plan.features as any;

  //   return {
  //     id: plan.id,
  //     name: plan.name,
  //     price: {
  //       // Convert from cents to dollars
  //       monthly: plan.monthlyPrice / 100,
  //       yearly: plan.yearlyPrice / 100,
  //     },
  //     description: featuresData?.description || "",
  //     stripePriceIds: {
  //       monthly: plan.stripePriceIdMonthly,
  //       yearly: plan.stripePriceIdYearly,
  //     },
  //     // Optional properties from features JSONB
  //     highlight: featuresData?.highlight || false,
  //     badge: featuresData?.badge || undefined,
  //     // Include icon component name
  //     icon: getIconNameByType(plan.type),
  //     // Map features array
  //     features: featuresData?.features || [],
  //     // Map feature limits
  //     feature_limits: {
  //       questions: plan.monthlyMessageLimit,
  //       tools: featuresData?.tools || [],
  //       pages: plan.monthlyFileUploadLimit,
  //     },
  //   };
  // });

  if (!isPart) {
    return (
      <div className="flex flex-col py-8 px-4 w-fit m-auto justify-center items-start">
        <h3 className="font-medium">This is a corporate version of Lawgic</h3>
        <p className="text-sm font-light text-center">
          You are not part of an organization. Request your organization to add
          you as a member.
        </p>
      </div>
    );
  }

  return (
    // <PricingSection
    //   tiers={finalPlans}
    //   currentSubscription={currentSubscription ?? null}
    // />
    <div className="flex flex-col py-8 px-4 w-fit m-auto justify-center items-start">
      <h3 className="font-medium">This is a corporate version of Lawgic</h3>
      <p className="text-sm font-light text-center">
        Request your organization to update your subscription.
      </p>
    </div>
  );
};

export default Plans;
