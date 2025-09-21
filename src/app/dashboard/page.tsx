"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth-provider';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (userProfile) {
      switch (userProfile.role) {
        case 'admin':
          router.replace('/dashboard/admin');
          break;
        case 'teacher':
          router.replace('/dashboard/teacher');
          break;
        case 'student':
          router.replace('/dashboard/student');
          break;
        default:
          router.replace('/login');
      }
    } else {
      router.replace('/login');
    }
  }, [userProfile, loading, router]);

  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="flex items-center space-x-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Loading your dashboard...</p>
      </div>
    </div>
  );
}
