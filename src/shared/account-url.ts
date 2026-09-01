const SITE_PREFIXES = new Set(["main", "blog", "tool"]);

function hostnameWithoutSite(hostname: string) {
  const labels = hostname.split(".");
  return SITE_PREFIXES.has(labels[0]) ? labels.slice(1).join(".") : hostname;
}

export function mainSiteOrigin(host: string, protocol = "https") {
  const [hostname, port] = host.toLowerCase().split(":", 2);
  const base = hostnameWithoutSite(hostname);
  const mainHostname = base === "localhost" ? "main.localhost" : base;
  return `${protocol}://${mainHostname}${port ? `:${port}` : ""}`;
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
        "blog.jadren.me",
        "tool.jadren.me",
        "jadren.debug",
        "blog.jadren.debug",
        "tool.jadren.debug",
        "main.localhost",
        "blog.localhost",
        "tool.localhost",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
