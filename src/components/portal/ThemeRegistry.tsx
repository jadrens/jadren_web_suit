"use client";

import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { ReactNode } from "react";
import { useTheme } from "@theme/ThemeProvider";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#89a0d2", light: "#a8b5c9", dark: "#7081a6" },
    secondary: { main: "#c9a87c", light: "#d4bc94", dark: "#b08f5f" },
    background: { default: "#f8f6f3", paper: "#fdfcfb" },
    text: { primary: "#3d3d3d", secondary: "#474747" },
    divider: "#e8e4df",
    action: { hover: "#f0ede8", selected: "#e8e4df" },
  },
  typography: {
    fontFamily: "'Nunito', var(--font-inter), system-ui, -apple-system, sans-serif",
  },
});

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#9db4d4", light: "#b8c5db", dark: "#7a92b8" },
    secondary: { main: "#c9a87c", light: "#d4bc94", dark: "#b08f5f" },
    background: { default: "#1e1e1e", paper: "#2a2a2a" },
    text: { primary: "#e8e4df", secondary: "#d3d3d3" },
    divider: "#3a3a3a",
    action: { hover: "#2f2f2f", selected: "#3a3a3a" },
  },
  typography: {
    fontFamily: "'Nunito', var(--font-inter), system-ui, -apple-system, sans-serif",
  },
});

function ThemedApp({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const currentTheme = theme === "dark" ? darkTheme : lightTheme;

  return (
    <MuiThemeProvider theme={currentTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

export default function ThemeRegistry({ children }: { children: ReactNode }) {
  return <ThemedApp>{children}</ThemedApp>;
}
