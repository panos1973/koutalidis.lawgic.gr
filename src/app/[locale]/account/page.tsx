import { NextPage } from "next";
import { getSubscriptionWithCurrentUsage } from "../actions/subscription";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Document, Message2 } from "iconsax-react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import Link from "next/link";

import { headers } from "next/headers";

interface Props {}

const Account: NextPage<Props> = async () => {
  const locale = await getLocale();
  const subscriptionAndUsage = await getSubscriptionWithCurrentUsage();
  //   console.log(subscriptionAndUsage);

  if (!subscriptionAndUsage) redirect(`/${locale}/plans`);

  // async function handlePortalRedirect() {
  //   "use server";
  //   // Get the host from headers
  //   const headersList = headers();
  //   const host = headersList.get("host") || "";
  //   // const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  //   const protocol = "https";

  //   // Construct the origin URL
  //   const origin = `${protocol}://${host}`;
  //   const returnUrl = `${origin}/${locale}/account`;

  //   const portalUrl = await createCustomerPortalSession(returnUrl);
  //   redirect(portalUrl);
  // }

  return (
    <div className="px-16 py-12">
      <h2 className="text-xl font-bold">Usage and Billing</h2>

      <div className="border px-8 py-6 rounded-xl mt-6">
        <div className="grid grid-cols-3 gap-8 items-center">
          <div>
            <p className="text-xs text-zinc-500">Plan</p>
            <p className="text-lg font-medium">
              {/* {subscriptionAndUsage?.subscription.plan?.name} */}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Payment</p>
            <p className="text-lg font-medium">
              €
              {/* {subscriptionAndUsage?.subscription.paymentInterval === "monthly"
                ? subscriptionAndUsage?.subscription.plan?.monthlyPrice! / 100
                : subscriptionAndUsage?.subscription.plan?.yearlyPrice! / 100}
              /{" "} */}
              <small className="text-xs text-zinc-600">
                {subscriptionAndUsage?.subscription.paymentInterval}
              </small>
            </p>
          </div>
          <div>
            <div className="flex space-x-2 items-center">
              {/* <form action={handlePortalRedirect}>
                <Button variant="ghost" size="sm">
                  Manage Subscription
                </Button>
              </form> */}

              {/* <Button size="sm" variant="ghost" className="text-red-500">
                <Link href={`/${locale}/plans`}>Upgrade</Link>
              </Button> */}
            </div>
          </div>
        </div>
        <hr className="my-4" />
        <div className="grid grid-cols-3 gap-8 items-center ">
          <div className="space-y-3">
            <p className="font-medium text-xs">Messages Used</p>
            <Progress
              value={subscriptionAndUsage?.usageMetrics.messages.percentage}
            />
            <div className="flex items-center justify-between">
              <div className="flex item-center space-x-2">
                <Message2 size={14} color="#555555" />
                <p className="text-xs">
                  {subscriptionAndUsage?.usageMetrics.messages.used} (
                  {subscriptionAndUsage?.usageMetrics.messages.percentage}%)
                </p>
              </div>
              <p className="text-xs">
                {subscriptionAndUsage?.usageMetrics.messages.totalLimit}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="font-medium text-xs">Pages Used</p>
            <Progress
              value={subscriptionAndUsage?.usageMetrics.uploads.percentage!}
            />
            <div className="flex items-center justify-between">
              <div className="flex item-center space-x-2">
                <Document size={14} color="#555555" />
                <p className="text-xs">
                  {subscriptionAndUsage?.usageMetrics.uploads.used} (
                  {subscriptionAndUsage?.usageMetrics.uploads.percentage}%)
                </p>
              </div>

              <p className="text-xs">
                {subscriptionAndUsage?.usageMetrics.uploads.totalLimit}
              </p>
            </div>
          </div>
          <Link href={`add-ons`}>
            <Button variant={"outline"} size="sm" className="w-fit">
              Buy More Credits
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Account;
