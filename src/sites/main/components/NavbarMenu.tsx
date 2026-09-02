"use client";

import NavbarAccountMenu from "@shared/components/NavbarAccountMenu";
import { useI18n } from "@shared/libs/i18n/main";
import { useSiteUrl } from "@shared/site-url";

export default function NavbarMenu() {
  const { t } = useI18n();
  const accountHref = useSiteUrl("tool", "/user-status");
  return <NavbarAccountMenu homeHref="/" settingsHref="/settings" accountHref={accountHref} homeLabel={t.nav.start} settingsLabel={t.nav.settings} accountLabel={t.nav.account} />;
}
