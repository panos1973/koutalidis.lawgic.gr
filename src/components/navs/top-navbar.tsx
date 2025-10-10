"use client";
import { NextPage } from "next";
import Image from "next/image";
import Link from "next/link";
import LocaltySelector from "./localty-selector";
import { ModeToggle } from "./theme-toggler";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { useLocale } from "next-intl";
interface Props {}

const TopNavbar: NextPage<Props> = () => {
  const locale = useLocale();
  return (
    <nav className="border-b border-slate-100 flex items-center justify-between px-4 h-[7svh] ">
      <Link href={"/"}>
        <h6 className="font-medium tracking-wider text-primary text-center uppercase ">
          Lawgic{" "}
          {/* <span className="text-xs text-blue-600 font-semibold">CORP</span> */}
        </h6>
      </Link>
      <div className="flex">
        <OrganizationSwitcher
          hidePersonal={true}
          createOrganizationMode="navigation"
          createOrganizationUrl={`/${locale}/organization/create`}
        />
        <LocaltySelector />
      </div>
    </nav>
  );
};

export default TopNavbar;
