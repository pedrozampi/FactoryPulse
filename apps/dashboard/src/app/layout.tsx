import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FactoryPulse | Telemetria Industrial',
  description: 'Dashboard de monitoramento de sensores industriais com RabbitMQ e TimescaleDB',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

