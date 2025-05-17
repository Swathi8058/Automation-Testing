import { Rocket } from 'lucide-react';
import Link from 'next/link';

export default function AppHeader() {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center">
        <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <Rocket className="h-7 w-7" />
          <h1 className="text-2xl font-semibold">TestPilot</h1>
        </Link>
      </div>
    </header>
  );
}
