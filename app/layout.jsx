import "../styles.css";

export const metadata = {
  title: "DenSpace",
  description: "A Frutiger Aero social feed powered by Neon Postgres and Vercel Blob.",
  applicationName: "DenSpace",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DenSpace",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/assets/denspace-icon.png" },
      { url: "/assets/denspace-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/denspace-icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/assets/denspace-icon-192.png"
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00a5d8"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
