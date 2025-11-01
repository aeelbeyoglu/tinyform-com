import HeaderWrapper from "@/components/header-wrapper";
import { Footer } from "@/components/footer";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-rows-[auto_1fr] h-svh">
      <HeaderWrapper />
      {children}
      <Footer />
    </div>
  );
}