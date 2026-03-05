import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { defaultLocale as defaultLanguage, locales } from "./config";
import { cookies } from "next/headers";
import { defineRouting } from "next-intl/routing";
import { isPartOfOrg } from "./lib/auth";

const getLocaleFromCookies = (defaultLocale = "el") => {
  const cookieStore = cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE");
  return localeCookie ? localeCookie.value : defaultLocale;
};

const isPublicRoute = createRouteMatcher([
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/(api|trpc)(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (
    req.nextUrl.pathname.startsWith("/api/") ||
    req.nextUrl.pathname.startsWith("/el/api/") ||
    req.nextUrl.pathname.startsWith("/en/api/")
  ) {
    return NextResponse.next();
  }

  const { userId, sessionClaims } = auth();
  console.log();

  // const userType = sessionClaims?.metadata?.userType;
  // const isOnboardingRoute = req.nextUrl.pathname.includes('/onboarding');
  const defaultLocale =
    sessionClaims?.metadata?.defaultLanguage || defaultLanguage;

  const locale = getLocaleFromCookies(defaultLocale);

  const routing = defineRouting({
    locales,
    defaultLocale,
  });

  const intlMiddleware = createIntlMiddleware(routing);

  // Detect Koutalidis tenant from hostname
  const hostname = req.headers.get("host") || "";
  const isKoutalidis = hostname.includes("koutalidis.lawgic.gr") ||
    process.env.NEXT_PUBLIC_TENANT_ID === "koutalidis";

  // For Koutalidis, redirect root to projects view
  if (isKoutalidis) {
    const pathname = req.nextUrl.pathname;
    if (
      pathname === `/${locale}` ||
      pathname === "/" ||
      pathname === `/${locale}/`
    ) {
      const projectsUrl = new URL(`/${locale}/projects`, req.url);
      return NextResponse.redirect(projectsUrl);
    }
  }

  if (!isPublicRoute(req)) {
    if (!userId) {
      const signInUrl = new URL(`/${locale}/sign-in`, req.url);
      return NextResponse.redirect(signInUrl);
    }
    // Check if organization data exists in sessionClaims
    const hasOrganization = sessionClaims?.o;

    // console.log("Organization ID from sessionClaims:", hasOrganization);
    // console.log("User ID:", userId);
    // console.log("Organization :", sessionClaims?.o);

    // Check if user is a member of an organization but doesn't have an active organization
    // This happens when a user is invited to an organization but the organization is not active
    // or when a user's organization has been deactivated
    const isMemberWithoutActiveOrg =
      !hasOrganization && (await isPartOfOrg(auth));

    // Redirect to organization selector if user doesn't have an organization and no pending approval
    if (
      !hasOrganization &&
      !req.nextUrl.pathname.includes("/plans") &&
      !req.nextUrl.pathname.includes("/organization")
    ) {
      const orgUrl = new URL(`/${locale}/plans`, req.url);
      return NextResponse.redirect(orgUrl);
    }

    // // Handle users who are members of organizations but don't have an active organization
    if (
      isMemberWithoutActiveOrg &&
      !req.nextUrl.pathname.includes("/organization")
    ) {
      console.log(
        "User is a member of an organization but doesn't have an active organization"
      );
      // Redirect to organization selector page to let them select or activate an organization
      const orgSelectorUrl = new URL(
        `/${locale}/organization/selector`,
        req.url
      );
      return NextResponse.redirect(orgSelectorUrl);
    }

    // If not part of an organization, redirect to plans page
    // if (
    //   !hasOrganization &&
    //   !req.nextUrl.pathname.includes("/plans") &&
    //   !req.nextUrl.pathname.includes("/organization")
    // ) {
    //   const plansUrl = new URL(`/${locale}/plans`, req.url);
    //   return NextResponse.redirect(plansUrl);
    // }

    auth().protect();
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/", "/(el|en)/:path*", "/(api|trpc)(.*)"],
};
