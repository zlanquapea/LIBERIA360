import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

// Resolves which locale a request is for and loads its message file. Falls
// back to the default locale (English) for a locale segment that isn't one
// of routing.locales, rather than throwing — matches next-intl's own
// recommended guard (see its docs on `hasLocale`).
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
