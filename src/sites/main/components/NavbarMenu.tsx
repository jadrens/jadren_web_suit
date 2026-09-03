"use client";

import NavbarAccountMenu from "@shared/components/NavbarAccountMenu";
import { useI18n } from "@shared/libs/i18n/main";

export default function NavbarMenu() {
  const { t } = useI18n();
  return <NavbarAccountMenu homeHref="/" settingsHref="/settings" accountHref="/user-status" homeLabel={t.nav.start} settingsLabel={t.nav.settings} accountLabel={t.nav.account} />;
}
