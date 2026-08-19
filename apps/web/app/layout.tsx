import type { ReactNode } from "react";
import "./globals.css";
import { ChatWidget } from "@/components/ChatWidget";

export const metadata = {
  title: "Concentrate School Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paper font-sans text-ink">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
