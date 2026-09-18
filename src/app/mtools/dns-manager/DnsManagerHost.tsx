"use client";

import { useTheme as useMuiTheme } from "@mui/material/styles";
import { useTheme as useSiteTheme } from "@theme/ThemeProvider";
import { useI18n } from "@lib/i18n/app";
import DnsManagerApp from "@dns/App";

export default function DnsManagerHost({ path }: { path: string }) {
  const { theme, toggleTheme } = useSiteTheme();
  const muiTheme = useMuiTheme();
  const { locale } = useI18n();

  return <DnsManagerApp
    basePath="/mtools/dns-manager/"
    path={path}
    enable_theme_switch_button={false}
    enable_i18n_switch_button={false}
    theme_data={{ mode: theme, theme: muiTheme, onChange: toggleTheme }}
    i18n_data={{ locale }}
  />;
}
