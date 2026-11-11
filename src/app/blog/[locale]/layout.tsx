import { notFound } from "next/navigation";

const CONTENT_LANG = { en: "en", zh: "zh-CN" } as const;

// The <html lang> follows the visitor's UI language; the posts under
// /blog/<locale> are in that locale's language whatever the UI is set to.
export default async function BlogLocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(locale in CONTENT_LANG)) notFound();
  return <div lang={CONTENT_LANG[locale as keyof typeof CONTENT_LANG]}>{children}</div>;
}
