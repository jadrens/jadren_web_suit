export function mainSiteOrigin(host: string, protocol = "https") {
  const [hostname, port] = host.toLowerCase().split(":", 2);
  return `${protocol}://${hostname}${port ? `:${port}` : ""}`;
}

export function isSafeAccountReturn(value: string | undefined) {
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      [
        "jadren.me",
        "jadren.debug",
        "localhost",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
