import { redirectToMainAccount } from "@shared/account-redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectToMainAccount("/login", await searchParams);
}
