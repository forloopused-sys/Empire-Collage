
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ref, onValue, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth-provider';
import { Exam, Course, Result, AttendanceSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { isWithinInterval, parseISO, format, startOfMonth, endOfMonth } from 'date-fns';
import { Terminal } from 'lucide-react';


export default function StudentExamsPage() {
    const { user, userProfile } = useAuth();
    const [exams, setExams] = useState<Exam[]>([]);
    const [courses, setCourses] = useState<Record<string, Course>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isEligible, setIsEligible] = useState(true);
    const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>({
        absentPenalty: 5,
        halfDayPenalty: 2.5,
        examEligibilityThreshold: 80,
    });

     useEffect(() => {
        const settingsRef = ref(db, 'settings/attendance');
        onValue(settingsRef, (snapshot) => {
            if(snapshot.exists()) {
                setAttendanceSettings(snapshot.val());
            }
        });
    }, []);

    useEffect(() => {
        if (!user || !userProfile || !userProfile.courseId) {
            setIsLoading(false);
            return;
        };

        const checkEligibility = async () => {
            const attendanceRef = ref(db, `attendance/${userProfile.courseId}`);
            const snapshot = await get(attendanceRef);
            if (snapshot.exists()) {
                const allAttendance = snapshot.val();
                let monthlyAbsences = 0;
                let monthlyHalfDays = 0;

                const today = new Date();
                const currentMonthStart = startOfMonth(today);
                const currentMonthEnd = endOfMonth(today);

                Object.keys(allAttendance).forEach(date => {
                    const dateObj = new Date(date);
                     if (dateObj >= currentMonthStart && dateObj <= currentMonthEnd) {
                        const dayRecord = allAttendance[date];
                        if (dayRecord?.[userProfile.uid]) {
                            const status = dayRecord[userProfile.uid];
                            if (status === 'absent') monthlyAbsences++;
                            if (status === 'half-day') monthlyHalfDays++;
                        }
                    }
                });

                const monthlyPercentage = 100 - (monthlyAbsences * attendanceSettings.absentPenalty) - (monthlyHalfDays * attendanceSettings.halfDayPenalty);
                if (monthlyPercentage < attendanceSettings.examEligibilityThreshold) {
                    setIsEligible(false);
                } else {
                    setIsEligible(true);
                }
            }
        };

        checkEligibility();
        
        const coursesRef = ref(db, 'courses');
        const unsubscribeCourses = onValue(coursesRef, (snapshot) => {
            if (snapshot.exists()) {
                setCourses(snapshot.val());
            }
        });

        const examsRef = ref(db, 'exams');
        const unsubscribeExams = onValue(examsRef, (snapshot) => {
            setIsLoading(true);
            const examsData = snapshot.val();
            const now = new Date();

            if (examsData && userProfile?.courseId && user) {
                const resultsRef = ref(db, 'results');
                get(resultsRef).then(resultsSnapshot => {
                    const resultsData: Record<string, Result> = resultsSnapshot.val() || {};
                    const userResults = Object.values(resultsData).filter(r => r.studentId === user.uid);

                    const availableExams = Object.entries(examsData)
                        .map(([id, exam]:[string, any]) => ({ id, ...exam }))
                        .filter(exam => {
                            const hasAttempted = userResults.some(r => r.examId === exam.id);
                            const isExamActive = isWithinInterval(now, { start: parseISO(exam.startTime), end: parseISO(exam.endTime) });
                            
                            return (
                                exam.courseId === userProfile.courseId &&
                                isExamActive &&
                                (exam.multipleAttempts || !hasAttempted)
                            );
                        });
                    setExams(availableExams);
                    setIsLoading(false);
                });
            } else {
                setExams([]);
                setIsLoading(false);
            }
        });

        return () => {
            unsubscribeCourses();
            unsubscribeExams();
        };

    }, [user, userProfile, attendanceSettings]);

    const getCourseName = (courseId: string) => courses[courseId]?.name || 'Unknown Course';

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Available Exams</CardTitle>
                    <CardDescription>Exams that are currently active and available for you to take.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Loading exams...</p> : (
                        !isEligible ? (
                             <Alert variant="destructive">
                                <Terminal className="h-4 w-4" />
                                <AlertTitle>Not Eligible for Exams</AlertTitle>
                                <AlertDescription>
                                    Your attendance for this month is below the required {attendanceSettings.examEligibilityThreshold}%. Please contact your administrator.
                                </AlertDescription>
                            </Alert>
                        ) : (
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Exam Name</TableHead>
                                        <TableHead>Course</TableHead>
                                        <TableHead>Ends On</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {exams.length > 0 ? exams.map(exam => (
                                        <TableRow key={exam.id}>
                                            <TableCell className="font-medium">{exam.name}</TableCell>
                                            <TableCell>{getCourseName(exam.courseId)}</TableCell>
                                            <TableCell>{format(parseISO(exam.endTime), "PPP p")}</TableCell>
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button>Start Exam</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you ready to begin?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Once you start, the timer will begin and you will enter full-screen mode.
                                                            Ensure you have a stable internet connection and are in a quiet environment.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction asChild>
                                                            <Link href={`/dashboard/student/exams/${exam.id}`}>Continue</Link>
                                                        </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24">
                                                No exams are currently available for you.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
