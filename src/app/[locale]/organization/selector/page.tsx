"use client";

import {
  OrganizationList,
  useAuth,
  useOrganizationList,
  useSession,
} from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { verifyOrganizationSelection } from "../../actions/organizations";

export default function SelectorPage() {
  const { userMemberships, isLoaded, setActive } = useOrganizationList({
    userMemberships: {
      pageSize: 5,
    },
  });
  const router = useRouter();
  const locale = useLocale();
  const auth = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const setActiveOrganization = async (id: string) => {
      if (setActive) {
        setIsVerifying(true);
        try {
          await setActive({ organization: id });
          console.log("Organization set successfully");
          // Redirect to homepage after setting organization
          router.push(`/${locale}`);
        } catch (error) {
          console.error("Error setting organization:", error);
          setIsVerifying(false);
        }
      }
    };

    if (isLoaded && !isVerifying) {
      if (userMemberships.count > 0 && !auth.orgId) {
        console.log("Setting organization...");
        setActiveOrganization(userMemberships.data[0].organization.id);
      }
    }
  }, [isLoaded, userMemberships, setActive, router, locale, isVerifying]);

  return (
    <div>
      {!isLoaded && "Setting the organisation for user....."}
      {isVerifying && "Verifying organization selection..."}
      {userMemberships?.data?.length === 0 && (
        <div>
          <p>No organizations found</p>
        </div>
      )}
      {/* <OrganizationList afterSelectOrganizationUrl={`/${locale}/plans`} /> */}
    </div>
  );
  return null;
}
