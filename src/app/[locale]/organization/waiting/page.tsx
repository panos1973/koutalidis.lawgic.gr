import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClockIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { checkPendingOrgApproval } from "../../actions/organizations";

export const metadata = {
  title: "Organization Status",
  description: "Check your organization approval status",
};

export default async function OrganizationWaitingPage({
  params,
}: {
  params: { locale: string };
}) {
  const { userId } = auth();
  const { locale } = params;

  if (!userId) {
    redirect(`/${locale}/sign-in`);
  }

  // Check if user has a pending organization
  const { hasPendingApproval, organization } = await checkPendingOrgApproval();

  if (!hasPendingApproval) {
    redirect(`/${locale}/plans`);
  }

  // Status badge styling and icon
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            <ClockIcon className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            <CheckCircleIcon className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            <XCircleIcon className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <ClockIcon className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  return (
    <div className="container max-w-2xl py-10">
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Organization Status</CardTitle>
            {getStatusBadge(organization?.status ?? "pending")}
          </div>
          <CardDescription>
            Your organization registration is being reviewed by our team
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Organization Name</h3>
              <p className="text-sm text-muted-foreground">
                {organization?.name ?? "No name provided"}
              </p>
            </div>

            <div>
              <h3 className="font-medium">Description</h3>
              <p className="text-sm text-muted-foreground">
                {organization?.description || "No description provided"}
              </p>
            </div>

            <div>
              <h3 className="font-medium">Submitted On</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(organization?.createdAt!).toLocaleDateString()}
              </p>
            </div>

            {organization?.status === "rejected" && (
              <div className="p-4 border rounded-md bg-red-50 border-red-200">
                <h3 className="font-medium text-red-700">Rejection Reason</h3>
                <p className="text-sm text-red-700">
                  {organization.rejectionReason || "No reason provided"}
                </p>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href={`/${locale}/plans`}>Back to Plans</Link>
          </Button>

          {organization?.status === "rejected" && (
            <Button asChild>
              <Link href={`/${locale}/organization/create`}>
                Create New Organization
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      {organization?.status === "pending" && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            We are reviewing your organization registration. This process
            typically takes 1-2 business days.
          </p>
          <p className="mt-2">
            You will receive an email notification once the review is complete.
          </p>
        </div>
      )}
    </div>
  );
}
