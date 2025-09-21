
"use client";

import { useState, useEffect, useMemo } from "react";
import { ref, onValue, set, get, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth-provider";
import { UserProfile, Course, LeaveRequest } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Check, Minus, Loader2, ClipboardX, CheckCheck, Slice, BarChart2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


type StudentAttendance = UserProfile & { status: 'present' | 'absent' | 'half-day' | 'unmarked'; isLeaveApproved: boolean };

export default function TeacherDashboard() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [teacherCourses, setTeacherCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});
  const [analytics, setAnalytics] = useState({ studentCount: 0, monthlyData: [] as any[] });
  
  const displayCourses = userProfile?.role === 'admin' ? allCourses : teacherCourses;

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
        if(snapshot.exists()) {
            setAllUsers(snapshot.val());
        }
    });

    const coursesRef = ref(db, 'courses');
    const unsubscribeCourses = onValue(coursesRef, (snapshot) => {
        if (snapshot.exists()) {
            const coursesData = snapshot.val();
            const coursesList: Course[] = Object.keys(coursesData).map(id => ({ id, ...coursesData[id] }));
            setAllCourses(coursesList);

            const userCourses = userProfile?.role === 'teacher' 
                ? coursesList.filter(c => userProfile.assignedCourses?.includes(c.id))
                : coursesList;

            setTeacherCourses(userCourses);
            if (userCourses.length > 0 && !selectedCourseId) {
                setSelectedCourseId(userCourses[0].id);
            }
        }
    });
    
    return () => {
        unsubscribeUsers();
        unsubscribeCourses();
    }
  }, [userProfile, selectedCourseId]);

  useEffect(() => {
    const leaveRequestsRef = ref(db, 'leaveRequests');
    const unsubscribeRequests = onValue(leaveRequestsRef, (snapshot) => {
      if(snapshot.exists()) {
          const allRequests: Record<string, Omit<LeaveRequest, 'id'>> = snapshot.val();
          const requestsList = Object.entries(allRequests).map(([id, request]) => ({ ...request, id }));
          setLeaveRequests(requestsList);
      } else {
          setLeaveRequests([]);
      }
    });
    return () => unsubscribeRequests();
  }, []);

  useEffect(() => {
    if (!selectedCourseId || Object.keys(allUsers).length === 0 || !date) {
      setStudents([]);
      setAnalytics({ studentCount: 0, monthlyData: [] });
      return;
    };
    
    const courseStudents = Object.values(allUsers)
        .filter(user => user.role === 'student' && user.courseId === selectedCourseId) as UserProfile[];
    
    setAnalytics(prev => ({ ...prev, studentCount: courseStudents.length }));
    
    // Fetch analytics data
    const attendanceRef = ref(db, `attendance/${selectedCourseId}`);
    get(attendanceRef).then(snapshot => {
        if(snapshot.exists()) {
            const courseAttendance = snapshot.val();
            const monthlyDataMap = new Map<string, { name: string, present: number, absent: number, halfDay: number }>();
            const today = new Date();
            const startOfCurrentMonth = startOfMonth(today);
            const endOfCurrentMonth = endOfMonth(today);

            Object.keys(courseAttendance).forEach(date => {
                const dateObj = new Date(date);
                if (dateObj >= startOfCurrentMonth && dateObj <= endOfCurrentMonth) {
                    const dayRecord = courseAttendance[date];
                    Object.values(dayRecord).forEach((status: any) => {
                        const dayName = format(dateObj, 'MMM d');
                        if (!monthlyDataMap.has(dayName)) {
                            monthlyDataMap.set(dayName, { name: dayName, present: 0, absent: 0, halfDay: 0 });
                        }
                        const dayData = monthlyDataMap.get(dayName)!;
                        if(status === 'present') dayData.present++;
                        if(status === 'absent') dayData.absent++;
                        if(status === 'half-day') dayData.halfDay++;
                    });
                }
            });
            setAnalytics(prev => ({...prev, monthlyData: Array.from(monthlyDataMap.values())}));
        }
    });

    if (!date) return;
    
    setIsLoading(true);
    const formattedDate = format(date, 'yyyy-MM-dd');
    const todaysAttendanceRef = ref(db, `attendance/${selectedCourseId}/${formattedDate}`);
    const approvedLeaveReqs = leaveRequests.filter(r => r.date === formattedDate && r.status === 'approved');

    get(todaysAttendanceRef).then((snapshot) => {
        const todaysAttendance = snapshot.val() || {};
        const studentsWithStatus: StudentAttendance[] = courseStudents.map(student => {
             const isLeaveApproved = approvedLeaveReqs.some(req => req.studentId === student.uid);
             return {
                ...student,
                status: isLeaveApproved ? 'absent' : (todaysAttendance[student.uid] || 'unmarked'),
                isLeaveApproved
             }
        });
        setStudents(studentsWithStatus);
        setIsLoading(false);
    });

  }, [selectedCourseId, date, allUsers, leaveRequests]);

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'half-day') => {
    setStudents(prevStudents => 
      prevStudents.map(student => 
        student.uid === studentId ? { ...student, status } : student
      )
    );
  };
  
  const markAllPresent = () => {
    setStudents(prevStudents => prevStudents.map(s => s.isLeaveApproved ? s : ({...s, status: 'present'})));
  }

  const saveAttendance = () => {
    if (!selectedCourseId || !date) return;
    setIsLoading(true);

    const dateStr = format(date, 'yyyy-MM-dd');
    const attendanceRef = ref(db, `attendance/${selectedCourseId}/${dateStr}`);
    
    const updates: Record<string, 'present' | 'absent' | 'half-day'> = {};
    students.forEach(student => {
      if (student.status !== 'unmarked') {
        updates[student.uid] = student.status;
      }
    });

    set(attendanceRef, updates)
      .then(() => {
        toast({ title: 'Success', description: 'Attendance saved successfully.' });
      })
      .catch((error) => {
        toast({ title: 'Error', description: 'Failed to save attendance.', variant: 'destructive' });
        console.error(error);
      })
      .finally(() => setIsLoading(false));
  };
  
  const handleRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    const requestRef = ref(db, `leaveRequests/${requestId}`);
    try {
        await update(requestRef, { status });
        
        if (status === 'approved') {
            const request = leaveRequests.find(r => r.id === requestId);
            if (request && request.courseId) {
                const attendanceRef = ref(db, `attendance/${request.courseId}/${request.date}`);
                await update(attendanceRef, { [request.studentId]: 'absent' });
            }
        }
        
        toast({ title: 'Success', description: `Request ${status}.` });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to update request.', variant: 'destructive' });
    }
  };
  
  const filteredLeaveRequests = useMemo(() => {
    if (!userProfile) return [];
    
        const relevantCourseIds = userProfile.role === 'admin'
            ? new Set(selectedCourseId ? [selectedCourseId] : [])
            : new Set(userProfile.assignedCourses || []);

        if (relevantCourseIds.size === 0 && userProfile.role !== 'admin') {
            return [];
        }

        return leaveRequests.filter(r => {
            if (userProfile.role === 'admin') {
                return selectedCourseId ? r.courseId === selectedCourseId : true;
            }
            return !!r.courseId && relevantCourseIds.has(r.courseId);
        });
  }, [leaveRequests, userProfile, selectedCourseId]);

  return (
    <Tabs defaultValue="attendance">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="attendance">Mark Attendance</TabsTrigger>
        <TabsTrigger value="requests">Leave Requests ({filteredLeaveRequests.filter(r => r.status === 'pending').length})</TabsTrigger>
      </TabsList>
       <TabsContent value="analytics">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart2 className="h-6 w-6"/>Course Analytics</CardTitle>
                <CardDescription>Analytics for {allCourses.find(c => c.id === selectedCourseId)?.name}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
                <Card>
                    <CardHeader><CardTitle>Student Count</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold">{analytics.studentCount}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>This Month's Attendance</CardTitle></CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="present" stackId="a" fill="#22c55e" name="Present" />
                                <Bar dataKey="halfDay" stackId="a" fill="#f59e0b" name="Half-day" />
                                <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
       </TabsContent>
      <TabsContent value="attendance">
        <div className="grid gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Mark Attendance</CardTitle>
                    <CardDescription>Select a class and date to manage student attendance.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger className="w-full sm:w-[280px]">
                            <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent>
                            {displayCourses.map(course => (
                                <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-full sm:w-[240px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => setDate(d || new Date())}
                        initialFocus
                        />
                    </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>
          {selectedCourseId && date && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Student List</CardTitle>
                  <CardDescription>Class: {allCourses.find(c => c.id === selectedCourseId)?.name} | Date: {format(date, "PPP")}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={markAllPresent}>Mark All Present</Button>
              </CardHeader>
              <CardContent>
                {isLoading ? <div className="flex justify-center items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                <div className="space-y-2">
                    <div className="rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Student</TableHead>
                                    <TableHead>Admission No.</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {students.length > 0 ? students.map(student => (
                                    <TableRow key={student.uid} className={student.isLeaveApproved ? 'bg-red-50' : ''}>
                                        <TableCell className="font-medium">{student.name}</TableCell>
                                        <TableCell>{student.admissionNo}</TableCell>
                                        <TableCell className="text-right">
                                            {student.isLeaveApproved ? (
                                                <Badge variant="destructive">LEAVE</Badge>
                                            ) : (
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="icon" variant={student.status === 'present' ? 'default' : 'outline'} onClick={() => handleStatusChange(student.uid, 'present')}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant={student.status === 'half-day' ? 'secondary' : 'outline'} onClick={() => handleStatusChange(student.uid, 'half-day')}>
                                                        <Slice className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant={student.status === 'absent' ? 'destructive' : 'outline'} onClick={() => handleStatusChange(student.uid, 'absent')}>
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                     <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">No students found for this class.</TableCell>
                                    </TableRow>
                                )}
                             </TableBody>
                        </Table>
                    </div>

                    {students.length > 0 && (
                        <Button className="w-full" onClick={saveAttendance} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Attendance'}
                        </Button>
                    )}
                </div>)}
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
      <TabsContent value="requests">
          <Card>
              <CardHeader>
                  <CardTitle>Leave Requests</CardTitle>
                  <CardDescription>Review and approve/reject student leave requests for your assigned courses.</CardDescription>
              </CardHeader>
              <CardContent>
                  <LeaveRequestTable requests={filteredLeaveRequests} onStatusChange={handleRequestStatus} />
              </CardContent>
          </Card>
      </TabsContent>
    </Tabs>
  );
}


function LeaveRequestTable({ requests, onStatusChange }: { requests: LeaveRequest[], onStatusChange: (id: string, status: 'approved' | 'rejected') => void }) {
    
    const getStatusVariant = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
        switch (status) {
            case 'approved': return 'default';
            case 'rejected': return 'destructive';
            case 'pending': return 'secondary';
            default: return 'outline';
        }
    };
    
    const pending = requests.filter(r => r.status === 'pending');
    const others = requests.filter(r => r.status !== 'pending');


    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pending.length > 0 ? pending.map(req => (
                    <TableRow key={req.id}>
                        <TableCell>{req.studentName}</TableCell>
                        <TableCell>{req.studentAdmissionNo}</TableCell>
                        <TableCell>{req.date}</TableCell>
                        <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                        <TableCell className="text-right">
                            {req.status === 'pending' && (
                                <>
                                    <Button variant="ghost" size="icon" onClick={() => onStatusChange(req.id, 'approved')}>
                                        <CheckCheck className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => onStatusChange(req.id, 'rejected')}>
                                        <ClipboardX className="h-4 w-4 text-red-600" />
                                    </Button>
                                </>
                            )}
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center">No pending leave requests found.</TableCell>
                    </TableRow>
                )}
                 {others.length > 0 && (
                    <TableRow key="archived-header"><TableCell colSpan={6} className="text-center font-bold bg-muted/50">Archived</TableCell></TableRow>
                 )}
                 {others.map(req => (
                    <TableRow key={req.id}>
                        <TableCell>{req.studentName}</TableCell>
                        <TableCell>{req.studentAdmissionNo}</TableCell>
                        <TableCell>{req.date}</TableCell>
                        <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                        <TableCell className="text-right"></TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
