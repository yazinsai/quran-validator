import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Can LLMs Quote the Quran? | Leaderboard',
  description: 'Benchmark testing how accurately different AI models can quote Quranic verses',
  openGraph: {
    title: 'Can LLMs Quote the Quran?',
    description: 'Benchmark testing how accurately different AI models can quote Quranic verses',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Can LLMs Quote the Quran?',
    description: 'Benchmark testing how accurately different AI models can quote Quranic verses',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-white antialiased">{children}</body>
    </html>
  );
}
