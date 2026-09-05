import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSafeAccountReturn, mainSiteOrigin } from "./account-url";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function redirectToMainAccount(
  pathname: "/login" | "/register" | "/verify-email",
  params: SearchParams = {}
): Promise<never> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "jadren.me";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") || host.includes(".debug") ? "http" : "https");
  const destination = new URL(pathname, mainSiteOrigin(host, protocol));

  if (pathname === "/login") {
    const requested = first(params.next);
    const currentOrigin = `${protocol}://${host}`;
    const returnTo = requested && isSafeAccountReturn(requested)
      ? new URL(requested, currentOrigin).toString()
      : currentOrigin;
    destination.searchParams.set("next", returnTo);
  } else if (pathname === "/verify-email") {
    for (const [key, value] of Object.entries(params)) {
      const resolved = first(value);
      if (resolved !== undefined) destination.searchParams.set(key, resolved);
    }
  }

  redirect(destination.toString());
}
