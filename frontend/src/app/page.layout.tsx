import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RedEngine - Home",
  description: "RedEngine home page",
};

export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
