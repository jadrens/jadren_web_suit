import DnsManagerHost from "../DnsManagerHost";

export default async function DnsManagerPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  return <DnsManagerHost path={`/${path.join("/")}`} />;
}
