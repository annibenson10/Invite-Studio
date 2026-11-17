import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invite Studio | Personalised Event Invitations",
  description: "Personalised invitations with unique QR codes, RSVPs and door check-in.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
