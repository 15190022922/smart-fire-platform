import { notFound } from "next/navigation";
import { TenantProfile } from "@/components/account/tenant-profile";
import { getServerSession } from "@/lib/server-auth";

export default async function TenantProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ forcePassword?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.scope !== "tenant") {
    notFound();
  }

  const resolvedSearchParams = await searchParams;

  return (
    <TenantProfile
      username={session.username}
      displayName={session.displayName}
      tenantName={session.tenantName ?? "当前企业"}
      forcePasswordChange={resolvedSearchParams.forcePassword === "1" || session.mustChangePassword === true}
    />
  );
}
