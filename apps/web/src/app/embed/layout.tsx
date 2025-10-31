import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}