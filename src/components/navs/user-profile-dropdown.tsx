"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClerk, useUser } from "@clerk/nextjs";
import { NextPage } from "next";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

interface Props {}

const UserProfileDropdown: NextPage<Props> = () => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const locale = useLocale() || "el";
  const t = useTranslations("common.userProfile");

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="h-10 w-10 m-auto border-2 hover:cursor-pointer">
            {user?.hasImage && (
              <AvatarImage src={user?.imageUrl} alt="User avatar" />
            )}
            <AvatarFallback className="bg-slate-300 w-full h-full text-slate-900 text-xs font-semibold uppercase">
              {/* {user?.lastName?.substring(0, 2)} */}
              <img src="https://api.dicebear.com/9.x/thumbs/svg" alt="avatar" />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            {user?.firstName} {user?.lastName}
            <small className="block font-light">
              {user?.primaryEmailAddress?.emailAddress}
            </small>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <Link
              className="cursor-pointer w-full "
              href={`/${locale}/user-profile`}
            >
              {t("profile")}
            </Link>
          </DropdownMenuItem>
          {/* <DropdownMenuItem>
            <Link className="cursor-pointer w-full" href={`/${locale}/account`}>
              {t("account")}
            </Link>
          </DropdownMenuItem> */}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer w-full"
            onClick={handleSignOut}
          >
            {t("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserProfileDropdown;
