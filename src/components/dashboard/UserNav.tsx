
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Building2,
  Users,
  Book,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  User,
  Clipboard,
  Bell,
  FileText,
  Award,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth-provider';

const adminNavItems = [
  { href: '/dashboard/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/admin/users', icon: Users, label: 'Users' },
  { href: '/dashboard/admin/courses', icon: Book, label: 'Courses' },
  { href: '/dashboard/teacher', icon: Clipboard, label: 'Attendance' },
  { href: '/dashboard/admin/exams', icon: FileText, label: 'Manage Exams' },
  { href: '/dashboard/admin/results', icon: Award, label: 'Manage Results' },
  { href: '/dashboard/admin/requests', icon: ClipboardCheck, label: 'Leave Requests' },
  { href: '/dashboard/admin/notifications', icon: Bell, label: 'Notifications' },
];

const teacherNavItems = [
  { href: '/dashboard/teacher', icon: Clipboard, label: 'Dashboard' },
  { href: '/dashboard/admin/exams', icon: FileText, label: 'Manage Exams' },
  { href: '/dashboard/admin/results', icon: Award, label: 'Manage Results' },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  { href: '/dashboard/profile', icon: User, label: 'Profile' },
];

const studentNavItems = [
  { href: '/dashboard/student', icon: LayoutDashboard, label: 'My Dashboard' },
  { href: '/dashboard/student/exams', icon: FileText, label: 'Exams' },
  { href: '/dashboard/student/results', icon: Award, label: 'Results' },
  { href: '/dashboard/notifications', icon: Bell, label: 'Notifications' },
  { href: '/dashboard/profile', icon: User, label: 'Profile' },
];

export function UserNav() {
  const pathname = usePathname();
  const { userProfile, signOut } = useAuth();

  let navItems = studentNavItems;
  if (userProfile?.role === 'admin') {
    navItems = adminNavItems;
  } else if (userProfile?.role === 'teacher') {
    navItems = teacherNavItems;
  } else if (userProfile?.role === 'student') {
    navItems = studentNavItems;
  }
  
  const isActive = (href: string) => {
    if (href.endsWith('admin') || href.endsWith('teacher') || href.endsWith('student')) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };


  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <TooltipProvider>
        <nav className="flex flex-col items-center gap-4 px-2 py-4">
          <Link
            href="/dashboard"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Building2 className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">Empire College</span>
          </Link>

          {navItems.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
                    isActive(item.href)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </TooltipProvider>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-4">
        <TooltipProvider>
            {userProfile?.role === 'admin' && (
                 <Tooltip>
                    <TooltipTrigger asChild>
                    <Link
                        href="/dashboard/admin/settings"
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 ${
                            isActive('/dashboard/admin/settings')
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Settings</span>
                    </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">Settings</TooltipContent>
                </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    try {
                      signOut();
                    } catch (e) {
                      window.location.href = '/login';
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors md:h-8 md:w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Logout"
                >
                  <Users className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </nav>
    </aside>
  );
}

    