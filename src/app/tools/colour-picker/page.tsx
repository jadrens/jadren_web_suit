import ColourPickerClient from "./ColourPickerClient";
import { createPageMetadata } from "@lib/seo";

export const metadata = createPageMetadata({
  title: "Colour Picker and Converter",
  description: "Pick a colour and convert it between HEX, HEXA, RGBA, HSL, HSV, and CMYK formats with live previews.",
  path: "/tools/colour-picker",
  keywords: ["colour picker", "color converter", "HEX to RGB", "RGBA", "HSL", "CMYK"],
});

export default function ColourPickerPage() {
  return <ColourPickerClient />;
}
