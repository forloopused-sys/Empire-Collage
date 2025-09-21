import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';

export default function SplashPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex flex-col items-center justify-center space-y-6 rounded-lg bg-card p-8 shadow-2xl">
        <div className="flex items-center space-x-4">
          <Building2 className="h-16 w-16 text-primary" />
          <div>
            <h1 className="font-headline text-4xl font-bold tracking-tighter text-primary sm:text-5xl md:text-6xl">
              Empire Attendance
            </h1>
            <p className="text-muted-foreground md:text-lg">
              BCA Students Attendance App
            </p>
          </div>
        </div>
        <p className="max-w-md text-foreground/80">
          Streamline your attendance tracking with ease and efficiency. Log in
          to get started.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg" className="font-headline">
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="font-headline">
            <Link href="/signup">Sign Up</Link>
          </Button>
        </div>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Developed by BCA 2024 Batch
      </p>
    </div>
  );
}
