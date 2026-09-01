import { Box, Avatar } from "@mui/material";
import StylizedName from "@tool/components/home/StylizedName";
import ConfettiBackground from "@shared/background/ConfettiBackground";
import Footer from "@tool/components/layout/Footer";
import { createPageMetadata } from "@shared/libs/seo";

export const metadata = createPageMetadata({
  title: "Free Online Developer Tools",
  description: "A fast, privacy-conscious online toolkit for DNS, IP lookup, Base64, QR codes, colour conversion, and short links.",
  path: "/",
  keywords: ["online developer tools", "free web tools", "DNS tools", "IP lookup", "Base64", "QR code generator"],
});

export default function Home() {
  return (
    <div>
      <ConfettiBackground />
        <div className="page-below-navbar flex flex-col">
          <main className="flex-1 flex items-center justify-center relative z-10">
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Avatar
                src="/shared/avatar.svg"
                alt="Jadren Rayne"
                sx={{
                  width: 136,
                  height: 136,
                  cursor: "pointer",
                  transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 220ms ease",
                  willChange: "transform",
                  "@media (hover: hover) and (pointer: fine)": {
                    "&:hover": {
                      transform: "scale(1.1) rotate(-2deg)",
                      filter: "brightness(1.05)",
                    },
                  },
                  "&:active": {
                    transform: "scale(0.94) rotate(0deg)",
                  },
                  "@media (prefers-reduced-motion: reduce)": {
                    transition: "none",
                    "&:hover, &:active": {
                      transform: "none",
                    },
                  },
                  "html[data-theme='dark'] &": {
                    boxShadow: `
                      0 0 30px 8px rgba(255, 255, 255, 0.09),
                      0 0 80px 30px rgba(255, 190, 100, 0.09),
                      0 0 160px 70px rgba(70, 76, 255, 0.09)
                    `,
                  },
                }}
              />
              <StylizedName />
            </Box>
          </main>
      </div>
      <Footer />
    </div>
  );
}
