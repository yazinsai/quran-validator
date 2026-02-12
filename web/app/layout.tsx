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
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-sage focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
