"use client";

import { useState, useEffect } from "react";
import { Fab, Zoom } from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Zoom in={visible}>
      <Fab
        onClick={handleClick}
        aria-label="Back to top"
        sx={{
          width: 40,
          height: 40,
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1300,
        }}
      >
        <KeyboardArrowUpIcon />
      </Fab>
    </Zoom>
  );
}