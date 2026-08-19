import type { ReactNode } from "react";
import "./globals.css";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata = {
  title: "Concentrate School Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
