export const metadata = {
  title: "Vault",
  description: "Personal reselling app — stock, listings and profit tracking.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Vault", statusBarStyle: "black-translucent" },
};

export const viewport = {
  themeColor: "#0B0B0D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, background: "#0B0B0D" }}>{children}</body>
    </html>
  );
}
