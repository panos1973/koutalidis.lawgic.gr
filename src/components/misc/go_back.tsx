"use client";
import { ArrowLeft, Link } from "iconsax-react";
import { NextPage } from "next";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";

interface Props {
  title?: string;
}

const GoBackButton: NextPage<Props> = ({ title }) => {
  const router = useRouter();
  return (
    <Button
      variant="link"
      size="sm"
      className="space-x-3 px-0 text-zinc-800"
      onClick={() => router.back()}
    >
      <ArrowLeft size={20} color="#555555" />
      {title && <p className="text-xs">{title}</p>}
    </Button>
  );
};

export default GoBackButton;
