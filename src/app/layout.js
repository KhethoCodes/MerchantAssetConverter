import './globals.css';

export const metadata = {
  title: 'Pinnacle Rewards — Merchant Image Standardization Portal',
  description: 'Prepare merchant lifestyle images for production in seconds.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-app min-h-screen text-brand-700 font-sans">{children}</body>
    </html>
  );
}
