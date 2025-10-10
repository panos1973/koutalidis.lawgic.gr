import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getAllPlans } from "../../actions/plans";
import OrganizationCreateForm from "@/components/organization/organization-create-form";
import { checkPendingOrgApproval } from "../../actions/organizations";

export const metadata = {
  title: "Create Organization",
  description: "Create a new organization and upload payment proof",
};

export default async function CreateOrganizationPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { planId?: string; interval?: string };
}) {
  const { userId } = auth();
  const { locale } = params;
  const { planId, interval } = searchParams;

  if (!userId) {
    redirect(`/${locale}/sign-in`);
  }
  if (!planId || !interval) {
    redirect(`/${locale}/plans`);
  }

  // Check if user already has a pending organization
  const { hasPendingApproval, organization } = await checkPendingOrgApproval(
    auth
  );

  if (hasPendingApproval) {
    redirect(`/${locale}/organization/waiting`);
  }

  // Get all plans to display the selected plan
  const plans = await getAllPlans();

  return (
    <div className="w-[90svw] py-10 px-28 max-h-[93svh] fixed overflow-y-scroll">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Create Organization
        </h1>
        <p className="text-muted-foreground mt-2">
          Complete your organization details and upload payment proof to
          continue
        </p>
      </div>

      <OrganizationCreateForm
        plans={plans}
        locale={locale}
        selectedPlanId={planId}
        interval={interval}
      />
    </div>
  );
}
