import "../styles.css";

export const metadata = {
  title: "DenSpace",
  description: "A Frutiger Aero social feed powered by Neon Postgres and Vercel Blob.",
  icons: {
    icon: "/assets/denspace-icon.png",
    apple: "/assets/denspace-icon.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
