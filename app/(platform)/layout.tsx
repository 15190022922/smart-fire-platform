import { TopNavigation } from "@/components/layout/top-navigation";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbfd_0%,#f3f6fa_100%)]">
      <TopNavigation />
      <main className="mx-auto h-[calc(100vh-68px)] w-full max-w-[1880px] overflow-y-auto px-3 pb-3 pt-3 sm:px-4 lg:px-6">
        {children}
      </main>
    </div>
  );
}
