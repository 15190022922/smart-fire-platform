import { TopNavigation } from "@/components/layout/top-navigation";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#f8fbfd_0%,#f3f6fa_100%)] lg:h-screen lg:overflow-hidden">
      <TopNavigation />
      <main
        className="mx-auto min-h-0 w-full max-w-[1880px] flex-1 overflow-y-auto px-2.5 pb-3 sm:px-3 lg:px-4"
        style={{ paddingTop: "var(--tenant-main-padding-top, 4px)" }}
      >
        {children}
      </main>
    </div>
  );
}
