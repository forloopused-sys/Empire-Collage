
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Building2,
  PanelLeft,
  Users,
  Book,
  LayoutDashboard,
  User,
  ClipboardCheck,
  Clipboard,
  Bell,
  GraduationCap,
  FileText,
  Award,
  Settings,
} from 'lucide-react';
import { UserNav } from './UserNav';
import { useAuth } from '@/hooks/use-auth-provider';

const adminNavItems = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/courses', label: 'Courses', icon: Book },
  { href: '/dashboard/teacher', label: 'Attendance', icon: Clipboard },
  { href: '/dashboard/admin/exams', label: 'Manage Exams', icon: FileText },
  { href: '/dashboard/admin/results', label: 'Manage Results', icon: Award },
  { href: '/dashboard/admin/requests', label: 'Leave Requests', icon: ClipboardCheck },
  { href: '/dashboard/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/admin/settings', label: 'Settings', icon: Settings },
];

const teacherNavItems = [
  { href: '/dashboard/teacher', label: 'Dashboard', icon: Clipboard },
  { href: '/dashboard/admin/exams', label: 'Manage Exams', icon: FileText },
  { href: '/dashboard/admin/results', label: 'Manage Results', icon: Award },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

const studentNavItems = [
  { href: '/dashboard/student', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/student/exams', label: 'Exams', icon: FileText },
  { href: '/dashboard/student/results', label: 'Results', icon: Award },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];


export function Header() {
  const pathname = usePathname();
  const { userProfile, studentNav } = useAuth();
  
  let navItems = studentNavItems;
  if (userProfile?.role === 'admin') {
    navItems = adminNavItems;
  } else if (userProfile?.role === 'teacher') {
    navItems = teacherNavItems;
  } else if (userProfile?.role === 'student') {
    // This can be customized by studentNav from useAuth if needed
    navItems = studentNavItems;
  }
  
  const isActive = (href: string) => {
    // Exact match for dashboard pages, prefix match for others
    if (href.endsWith('admin') || href.endsWith('teacher') || href.endsWith('student')) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const pageTitle = navItems.find(item => isActive(item.href))?.label || "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="/dashboard"
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <Building2 className="h-5 w-5 transition-all group-hover:scale-110" />
              <span className="sr-only">Empire College</span>
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-2.5 ${
                  isActive(item.href)
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <h1 className="font-headline text-xl font-semibold">{pageTitle}</h1>
      <div className="relative ml-auto flex-1 md:grow-0">
      </div>
      <UserNav />
    </header>
  );
}

    