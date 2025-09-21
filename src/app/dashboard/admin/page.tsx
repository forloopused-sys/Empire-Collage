
"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ref, onValue, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Book, ArrowRight, Briefcase } from 'lucide-react';
import { UserProfile } from '@/lib/types';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0, workingDays: 0 });

  useEffect(() => {
    // Fetch users for stats
    const usersRef = ref(db, 'users');
    const usersUnsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const allUsers: Record<string, UserProfile> = snapshot.val();
        const students = Object.values(allUsers).filter(u => u.role === 'student').length;
        const teachers = Object.values(allUsers).filter(u => u.role === 'teacher').length;
        setStats(prev => ({ ...prev, students, teachers }));
      }
    });

    // Fetch courses for stats
    const coursesRef = ref(db, 'courses');
    const coursesUnsubscribe = onValue(coursesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allCourses = snapshot.val();
        setStats(prev => ({ ...prev, courses: Object.keys(allCourses).length }));
      }
    });
    
    // Fetch attendance for working days
    const attendanceRef = ref(db, 'attendance');
    get(attendanceRef).then((snapshot) => {
        if (snapshot.exists()) {
            const allAttendance = snapshot.val();
            const uniqueDates = new Set<string>();
            Object.values(allAttendance).forEach((courseAttendance: any) => {
                Object.keys(courseAttendance).forEach(date => uniqueDates.add(date));
            });
            setStats(prev => ({ ...prev, workingDays: uniqueDates.size }));
        }
    });


    return () => {
      usersUnsubscribe();
      coursesUnsubscribe();
    };
  }, []);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.students}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teachers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <Book className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.courses}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Working Days</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.workingDays}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <Link href="/dashboard/admin/users">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Manage Users
                <Users className="h-6 w-6 text-primary" />
              </CardTitle>
              <CardDescription>Add, edit, or remove students and teachers.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-sm font-medium text-primary flex items-center">
                    Go to User Management <ArrowRight className="ml-2 h-4 w-4" />
                </div>
            </CardContent>
          </Link>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <Link href="/dashboard/admin/courses">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Manage Courses
                <Book className="h-6 w-6 text-primary" />
              </CardTitle>
              <CardDescription>Create, update, and delete academic courses.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-sm font-medium text-primary flex items-center">
                    Go to Course Management <ArrowRight className="ml-2 h-4 w-4" />
                </div>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}

    