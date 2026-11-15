import { describe, expect, test } from "bun:test";
import { AUTH_WINDOW_MS, CAPTCHA_LIFETIME_MS, createCaptchaStore, FREE_AUTH_REQUESTS } from "./store";
import { CAPTCHA_ALPHABET, CAPTCHA_HEIGHT, CAPTCHA_WIDTH, randomCaptchaText, renderCaptchaGif } from "./render";

const IP = "192.0.2.1";

function store() {
  return createCaptchaStore({ databasePath: ":memory:", render: () => new Uint8Array([1]), text: () => "AC3EF" });
}

function useUpFreeRequests(captcha: ReturnType<typeof store>, now = 1_000) {
  for (let i = 0; i < FREE_AUTH_REQUESTS; i++) expect(captcha.admit(IP, null, now)).toBe("allowed");
}

describe("captcha gate", () => {
  test("lets the first requests through, then requires a solution", () => {
    const captcha = store();
    try {
      useUpFreeRequests(captcha);
      expect(captcha.admit(IP, null, 1_000)).toBe("captcha_required");
      // Rejected requests are not counted, and other addresses are unaffected.
      expect(captcha.admit("192.0.2.2", null, 1_000)).toBe("allowed");
    } finally {
      captcha.close();
    }
  });

  test("accepts a correct answer once, case- and space-insensitively", () => {
    const captcha = store();
    try {
      useUpFreeRequests(captcha);
      const { id } = captcha.issue(IP, 1_000)!;
      expect(captcha.admit(IP, `${id}. ac3 ef `, 2_000)).toBe("allowed");
      expect(captcha.admit(IP, `${id}.AC3EF`, 2_000)).toBe("captcha_invalid");
    } finally {
      captcha.close();
    }
  });

  test("burns a challenge on a wrong answer", () => {
    const captcha = store();
    try {
      useUpFreeRequests(captcha);
      const { id } = captcha.issue(IP, 1_000)!;
      expect(captcha.admit(IP, `${id}.WRONG`, 2_000)).toBe("captcha_invalid");
      expect(captcha.admit(IP, `${id}.AC3EF`, 2_000)).toBe("captcha_invalid");
    } finally {
      captcha.close();
    }
  });

  test("rejects expired challenges and challenges issued to another address", () => {
    const captcha = store();
    try {
      useUpFreeRequests(captcha);
      const stale = captcha.issue(IP, 1_000)!;
      expect(captcha.admit(IP, `${stale.id}.AC3EF`, 1_000 + CAPTCHA_LIFETIME_MS + 1)).toBe("captcha_invalid");
      const foreign = captcha.issue("198.51.100.7", 1_000)!;
      expect(captcha.admit(IP, `${foreign.id}.AC3EF`, 2_000)).toBe("captcha_invalid");
      expect(captcha.admit(IP, "garbage", 2_000)).toBe("captcha_invalid");
    } finally {
      captcha.close();
    }
  });

  test("checks answers without spending the request allowance", () => {
    const captcha = store();
    try {
      const { id } = captcha.issue(IP, 1_000)!;
      expect(captcha.check(IP, `${id}.ac3ef`, 2_000)).toBe(true);
      expect(captcha.check(IP, `${id}.AC3EF`, 2_000)).toBe(false);
      const wrong = captcha.issue(IP, 1_000)!;
      expect(captcha.check(IP, `${wrong.id}.WRONG`, 2_000)).toBe(false);
      useUpFreeRequests(captcha, 2_000);
    } finally {
      captcha.close();
    }
  });

  test("forgets requests older than the window", () => {
    const captcha = store();
    try {
      useUpFreeRequests(captcha);
      expect(captcha.admit(IP, null, 1_000 + AUTH_WINDOW_MS - 1)).toBe("captcha_required");
      expect(captcha.admit(IP, null, 1_001 + AUTH_WINDOW_MS)).toBe("allowed");
    } finally {
      captcha.close();
    }
  });

  test("limits how many challenges one address may fetch", () => {
    const captcha = store();
    try {
      for (let i = 0; i < 20; i++) expect(captcha.issue(IP, 1_000)).not.toBeNull();
      expect(captcha.issue(IP, 1_000)).toBeNull();
      expect(captcha.issue("192.0.2.2", 1_000)).not.toBeNull();
    } finally {
      captcha.close();
    }
  });
});

describe("captcha image", () => {
  test("renders an animated, looping GIF of the expected size", () => {
    const gif = renderCaptchaGif("AC3EF");
    expect(new TextDecoder().decode(gif.subarray(0, 6))).toBe("GIF89a");
    const view = new DataView(gif.buffer, gif.byteOffset);
    expect(view.getUint16(6, true)).toBe(CAPTCHA_WIDTH);
    expect(view.getUint16(8, true)).toBe(CAPTCHA_HEIGHT);
    expect(gif[gif.length - 1]).toBe(0x3b);
    expect(gif.length).toBeLessThan(400_000);
  });

  test("draws text only from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      for (const char of randomCaptchaText(5)) expect(CAPTCHA_ALPHABET).toContain(char);
    }
  });
});
