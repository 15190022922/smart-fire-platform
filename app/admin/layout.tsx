import { SaaSShell } from "@/components/saas/saas-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SaaSShell>{children}</SaaSShell>;
}
