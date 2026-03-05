import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider, OrganizationList } from "@clerk/nextjs";
import "./globals.css";
import SideNavbar from "@/components/navs/side-navbar";
import TopNavbar from "@/components/navs/top-navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import MobileNavbar from "@/components/navs/mobile-navbar";
import Favicon from "./favicon.ico";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { elGR, enUS } from "@clerk/localizations";
import { checkUsageLimits } from "./actions/subscription";
import { headers } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

function isKoutalidisTenant(): boolean {
  const headersList = headers();
  const host = headersList.get("host") || "";
  return (
    host.includes("koutalidis.lawgic.gr") ||
    process.env.NEXT_PUBLIC_TENANT_ID === "koutalidis"
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const isKoutalidis = isKoutalidisTenant();
  return {
    title: isKoutalidis ? "Koutalidis Lawgic" : "Lawgic",
    description: isKoutalidis ? "Koutalidis Law Firm AI Platform" : "Lawbot",
    icons: [{ rel: "icon", url: Favicon.src }],
  };
}

export default async function RootLayout({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode;
  params: { locale: "el" | "en" };
}>) {
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
  const subscriptionData = await checkUsageLimits();
  const isKoutalidis = isKoutalidisTenant();

  return (
    <ClerkProvider
      localization={locale === "en" ? enUS : elGR}
      afterSignOutUrl={`/${locale}/sign-in`}
    >
      <html lang={locale} suppressHydrationWarning>
        <body className={`${inter.className}  antialiased`}>
          <NextIntlClientProvider messages={messages}>
            <ThemeProvider
            //   attribute='class'
            //   defaultTheme='light'
            //   enableSystem
            //   disableTransitionOnChange
            >
              {isKoutalidis ? (
                // Koutalidis layout: the (koutalidis) route group handles its own header/sidebar
                <div className="h-screen overflow-hidden">
                  {children}
                </div>
              ) : (
                // Corp layout: original navigation
                <>
                  <TopNavbar />
                  <div className="flex flex-col md:flex-row">
                    <div className="hidden md:block">
                      <SideNavbar subscriptionData={subscriptionData} />
                    </div>
                    <div className="w-full h-[83svh]">{children}</div>
                    <div className="md:hidden w-full  ">
                      <MobileNavbar />
                    </div>
                  </div>
                </>
              )}
              <Toaster position="bottom-center" />
            </ThemeProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
