import { TinyFormNavbar } from "@/components/tinyform-navbar";
import { TinyFormFooter } from "@/components/tinyform-footer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <TinyFormNavbar />
      <main className="flex-1">
        {children}
      </main>
      <TinyFormFooter />
    </div>
  );
}