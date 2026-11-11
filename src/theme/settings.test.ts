import { expect, test } from "bun:test";
import { calculateSolar, currentAutomaticTheme } from "./settings";

test("automatic theme still resolves when browser storage is unavailable", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
  try {
    expect(currentAutomaticTheme({ latitude: 35.68, longitude: 139.69, source: "manual" })).toMatch(/^(light|dark)$/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("solar events remain ordered when they cross UTC midnight", () => {
  for (const longitude of [139.69, -122.42]) {
    const solar = calculateSolar({ latitude: 35.68, longitude, source: "manual" }, new Date(2026, 5, 15, 12));
    expect(solar).not.toBeNull();
    expect(solar!.sunrise).toBeLessThan(solar!.sunset);
    expect(solar!.sunset - solar!.sunrise).toBeLessThan(24 * 60 * 60 * 1000);
  }
});
