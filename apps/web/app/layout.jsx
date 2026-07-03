import "./globals.css";

export const metadata = {
  title: "Home Energy & EV Research",
  description: "Competitive intelligence on North American home energy & EV charging apps.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-accent="indigo" data-font="system" data-density="comfortable">
      <body>{children}</body>
    </html>
  );
}
