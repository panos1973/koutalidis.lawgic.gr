"use server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const isPartOfOrg = async (authInstance?: any) => {
  const user = authInstance ? authInstance() : auth();

  if (!user.userId) {
    return false;
  }

  const client = clerkClient();

  const orgs = await client.users.getOrganizationMembershipList({
    userId: user.userId,
  });

  return orgs.data.length > 0;
};
