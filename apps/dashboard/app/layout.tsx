import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AgentGuard Dashboard",
  description: "Security assessment and certification for AI agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#3b82f6",
          colorText: "#ffffff",
          colorBackground: "#0a0a0a",
          colorInputBackground: "#1a1a1a",
          colorInputText: "#ffffff",
        },
        elements: {
          formButtonPrimary: 
            "bg-blue-500 hover:bg-blue-600 text-white",
          card: "bg-gray-900 border border-gray-800",
          headerTitle: "text-white",
          headerSubtitle: "text-gray-400",
          socialButtonsBlockButton: 
            "bg-gray-800 hover:bg-gray-700 border-gray-700",
          socialButtonsBlockButtonText: "text-white",
          dividerLine: "bg-gray-700",
          dividerText: "text-gray-400",
          formFieldLabel: "text-gray-300",
          formFieldInput: 
            "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500",
          footerActionLink: "text-blue-400 hover:text-blue-300",
        },
      }}
    >
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
