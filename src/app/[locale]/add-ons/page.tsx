import { Sparkles, Zap, ArrowDownToDot, Star, Sparkle } from "lucide-react";
import { getCurrentSubscription } from "../actions/subscription";
import { getAllActiveAddOns } from "../actions/add-ons";
import { AddOnSection } from "@/components/blocks/add-on-section";
import { AddOn } from "@/lib/types/types";
import { is } from "drizzle-orm";

const getIconByType = (type: string): React.ReactElement => {
  switch (type) {
    case "messages":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
          <Zap className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
        </div>
      );
    case "storage":
      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gray-500/30 to-gray-500/30 blur-2xl rounded-full" />
          <Sparkle className="w-7 h-7 relative z-10 text-gray-500 dark:text-gray-400 animate-[float_3s_ease-in-out_infinite]" />
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

const AddOnsPage = async () => {
  const addOns = await getAllActiveAddOns();
  const currentSubscription = await getCurrentSubscription();

  // const formattedAddOns = addOns.map((addOn) => ({
  //   id: addOn.id,
  //   name: addOn.name,
  //   price: addOn.price / 100, // Convert from cents to euros
  //   description: addOn.description || "",
  //   type: addOn.type,
  //   stripePriceId: addOn.stripePriceId,
  //   additionalMessageCount: addOn.additionalMessageCount || 0,
  //   additionalFileUploadCount: addOn.additionalFileUploadCount || 0,
  //   isActive: addOn.isActive!,
  //   createdAt: addOn.createdAt,
  //   updatedAt: addOn.updatedAt,
  //   icon: getIconByType(addOn.type),
  // }));

  return (
    // <AddOnSection
    //   addOns={formattedAddOns}
    //   currentSubscription={currentSubscription}
    // />
    null
  );
};

export default AddOnsPage;
