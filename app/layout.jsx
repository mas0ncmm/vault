export const metadata = {
  title: "Resell HQ",
  description: "Personal reselling app — stock, listings and profit tracking.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Resell HQ", statusBarStyle: "black-translucent" },
};

export const viewport = {
  themeColor: "#0B0B0C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, background: "#0B0B0C" }}>{children}</body>
    </html>
  );
}
