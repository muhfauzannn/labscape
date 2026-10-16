import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const sans = localFont({
  src: "../../public/fonts/dm-sans-variable.ttf",
  variable: "--font-sans",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "Labscape — Learn how things work.",
    template: "%s · Labscape",
  },
  description:
    "Explore interactive machines, experiment with live controls, and ask Labscape AI how things work.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      {/* Extensions can inject __processed_* attributes before React hydrates.
          Limit suppression to the body element; descendants remain checked. */}
      <body suppressHydrationWarning>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
