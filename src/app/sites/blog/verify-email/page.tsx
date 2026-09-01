import { redirectToMainAccount } from "@shared/account-redirect";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return redirectToMainAccount("/verify-email", await searchParams);
}
