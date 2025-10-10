"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
// import { createContractComparison } from "@/app/[locale]/actions/contract_comparison_actions";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createContractComparison } from "@/app/[locale]/actions/contract_comparison_actions";
import { useLocale, useTranslations } from "next-intl";

interface Props {
  variant?: "default" | "outline" | "ghost";
}

const CreateNewContractComparison = ({ variant = "default" }: Props) => {
  const router = useRouter();
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const locale = useLocale() || "el";
  const t = useTranslations("contractComparison.home");

  const handleCreateComparison = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const comparisonId = await createContractComparison(userId);
      router.push(`/${locale}/compare-contract/${comparisonId}`);
    } catch (error) {
      console.error("Error creating comparison:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleCreateComparison}
      className="w-full"
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        t("new")
      )}
    </Button>
  );
};

export default CreateNewContractComparison;
