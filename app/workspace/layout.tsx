import { redirect } from "next/navigation";

export default function WorkspaceLegacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void children;
  redirect("/");
}
