import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { checkUsageLimits } from "./actions/subscription";
import Link from "next/link";

export default async function Home() {
  const t = await getTranslations("common");
  const subData = await checkUsageLimits();
  const locale = await getLocale();
  return (
    <div className="md:h-[93svh] h-[83svh] flex flex-col justify-center items-center  ">
      {!subData.active_subscription && (
        <div className="mb-4 w-full text-center bg-red-50 max-w-fit p-4 rounded-2xl text-sm font-medium">
          You are not subscribed to any plans, ask you organization to update
          your subscription.
        </div>
      )}
      <div className="border rounded-2xl p-5 w-[90svw] md:w-[70%] max-h-[70svh] md:max-h-full overflow-y-scroll md:overflow-y-hidden">
        <p
          className="text-sm"
          dangerouslySetInnerHTML={{ __html: t.raw("home") }}
        ></p>
      </div>
    </div>
  );
}
