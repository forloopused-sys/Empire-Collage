

"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { ref, onValue, update, get } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { UserProfile, Notification, Result } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { LayoutDashboard, Bell, User as UserIcon, Award } from 'lucide-react';
import { isPast, parseISO } from 'date-fns';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  unreadNotifications: number;
  markAllNotificationsAsRead: () => void;
  studentNav: { navItems: { href: string; label: string; icon: any }[] };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const baseStudentNav = [
  { href: '/dashboard/student', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/profile', label: 'Profile', icon: UserIcon },
];

const studentNavWithResults = [
    ...baseStudentNav,
    { href: '/dashboard/student/results', label: 'Results', icon: Award },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [studentNav, setStudentNav] = useState({ navItems: baseStudentNav });
  const router = useRouter();
  const pathname = usePathname();

  const calculateUnread = useCallback((notifications: Record<string, Notification>, currentProfile: UserProfile | null, currentUser: User | null) => {
    if (!currentProfile || !currentUser) return 0;
    
    return Object.values(notifications).filter(notif => {
      const isUnread = !notif.readBy || !notif.readBy[currentUser.uid];
      if (!isUnread) return false;

      if (notif.recipientRole === 'all') return true;
      if (notif.recipientRole === currentProfile.role) {
        if (currentProfile.role === 'student' && notif.recipientCourseId) {
          return notif.recipientCourseId === currentProfile.courseId;
        }
        if (currentProfile.role === 'teacher' && notif.recipientCourseId) {
          return currentProfile.assignedCourses?.includes(notif.recipientCourseId);
        }
        return true;
      }
      return false;
    }).length;
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        
        const unsubscribeProfile = onValue(userRef, (snapshot) => {
          const profile = snapshot.exists() ? (snapshot.val() as UserProfile) : null;
          setUserProfile(profile);

          if(profile?.role === 'student') {
              const resultsRef = ref(db, 'results');
              onValue(resultsRef, (resultsSnapshot) => {
                  if(resultsSnapshot.exists()){
                      const allResults: Result[] = Object.values(resultsSnapshot.val());
                      const hasPublishedResults = allResults.some(r => 
                          r.studentId === user.uid && 
                          r.isPublished &&
                          (!r.publishDate || isPast(parseISO(r.publishDate)))
                      );
                      if(hasPublishedResults) {
                          setStudentNav({ navItems: studentNavWithResults });
                      } else {
                          setStudentNav({ navItems: baseStudentNav });
                      }
                  }
              });
          }

          const notificationsRef = ref(db, 'notifications');
          const unsubscribeNotifications = onValue(notificationsRef, (snapshot) => {
            if (snapshot.exists()) {
              const allNotifications: Record<string, Notification> = snapshot.val();
              const count = calculateUnread(allNotifications, profile, user);
              setUnreadNotifications(count);
            }
          });

          if (!profile && !loading) {
             setLoading(false);
          } else if (profile) {
              setLoading(false);
          }

          return () => {
            unsubscribeNotifications();
          }
        });
        
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
        setUnreadNotifications(0);
        setStudentNav({ navItems: baseStudentNav });
      }
    });

    return () => unsubscribeAuth();
  }, [loading, calculateUnread]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!user || !pathname.includes('/notifications')) return;
    const notificationsSnapshot = await get(ref(db, 'notifications'));
    if (notificationsSnapshot.exists()) {
        const updates: Record<string, any> = {};
        const allNotifications: Record<string, Notification> = notificationsSnapshot.val();

        Object.keys(allNotifications).forEach(key => {
            updates[`/notifications/${key}/readBy/${user.uid}`] = true;
        });

        await update(ref(db), updates);
    }
  }, [user, pathname]);

  useEffect(() => {
    markAllNotificationsAsRead();
  }, [pathname, markAllNotificationsAsRead]);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname === '/login' || pathname === '/signup';
    const isSplashPage = pathname === '/';

    if (!user && !isAuthPage && !isSplashPage) {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);


  const signOut = async () => {
    await firebaseSignOut(auth);
    router.push('/login');
  };

  const value = { user, userProfile, loading, signOut, unreadNotifications, markAllNotificationsAsRead, studentNav };
  
  if (loading && !['/', '/login', '/signup'].includes(pathname)) {
    return (
       <div className="flex h-screen w-full items-center justify-center">
        <div className="w-full max-w-md space-y-4 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
