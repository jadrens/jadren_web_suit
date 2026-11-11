export function mainSiteOrigin(host: string, protocol = "https") {
  const [hostname, port] = host.toLowerCase().split(":", 2);
  return `${protocol}://${hostname}${port ? `:${port}` : ""}`;
}

export function isSafeAccountReturn(value: string | undefined) {
  // Browsers strip control characters and treat backslashes as URL separators.
  // Reject these before parsing so a local-looking path cannot become a host.
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return false;
  try {
    if (value.startsWith("/")) {
      const base = "https://account-return.invalid";
      return !value.startsWith("//") && new URL(value, base).origin === base;
    }
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      [
        "jadren.me",
        "jadren.cn",
        "jadren.debug",
        "localhost",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
