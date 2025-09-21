

"use client";
import { useEffect, useState } from "react";
import { ref, onValue, push, set, remove, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Course, LeaveRequest, UserProfile, AttendanceSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Loader2, Edit, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


export default function StudentDashboard() {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();
  const [course, setCourse] = useState<Course | null>(null);
  const [attendance, setAttendance] = useState({
      totalPercentage: 0,
      monthlyPercentage: 0,
  });
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>({
      absentPenalty: 5,
      halfDayPenalty: 2.5,
      examEligibilityThreshold: 80,
  });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveDate, setLeaveDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [monthlyChartData, setMonthlyChartData] = useState<any[]>([]);

  useEffect(() => {
    const settingsRef = ref(db, 'settings/attendance');
    onValue(settingsRef, (snapshot) => {
        if(snapshot.exists()) {
            setAttendanceSettings(snapshot.val());
        }
    });

    if (userProfile?.role !== "student" || !userProfile.uid || !userProfile.courseId) return;

    if (userProfile.courseId) {
        const courseRef = ref(db, `courses/${userProfile.courseId}`);
        onValue(courseRef, (snapshot) => {
            if (snapshot.exists()) setCourse({ id: userProfile.courseId!, ...snapshot.val() });
        });

        const attendanceRef = ref(db, `attendance/${userProfile.courseId}`);
        onValue(attendanceRef, (snapshot) => {
            if (snapshot.exists()) {
                const allAttendance = snapshot.val();
                let totalDays = 0, daysPresent = 0, daysAbsent = 0, daysHalf = 0;
                let monthlyDays = 0, monthlyAbsences = 0, monthlyHalfDays = 0;

                const today = new Date();
                const currentMonthStart = startOfMonth(today);
                const currentMonthEnd = endOfMonth(today);
                
                const chartDataMap = new Map<string, {name: string, present: number, absent: number, halfDay: number}>();

                Object.keys(allAttendance).forEach(date => {
                    const dayRecord = allAttendance[date];
                    if (dayRecord?.[userProfile.uid]) {
                        totalDays++;
                        const dateObj = new Date(date);
                        const status = dayRecord[userProfile.uid];

                        if (status === 'present') { daysPresent++; }
                        else if (status === 'absent') { daysAbsent++; }
                        else if (status === 'half-day') { daysHalf++; }
                        
                        // Monthly calculation
                        if (dateObj >= currentMonthStart && dateObj <= currentMonthEnd) {
                            monthlyDays++;
                            if (status === 'absent') monthlyAbsences++;
                            if (status === 'half-day') monthlyHalfDays++;
                        }
                        
                        const monthKey = format(dateObj, 'MMM yyyy');
                        if (!chartDataMap.has(monthKey)) {
                            chartDataMap.set(monthKey, { name: format(dateObj, 'MMM'), present: 0, absent: 0, halfDay: 0 });
                        }
                        const monthData = chartDataMap.get(monthKey)!;
                        if(status === 'present') monthData.present++;
                        if(status === 'absent') monthData.absent++;
                        if(status === 'half-day') monthData.halfDay++;
                    }
                });
                
                const overallPresent = daysPresent + (daysHalf * 0.5);

                const monthlyPercentage = 100 - (monthlyAbsences * attendanceSettings.absentPenalty) - (monthlyHalfDays * attendanceSettings.halfDayPenalty);
                
                setAttendance({
                    totalPercentage: totalDays > 0 ? (overallPresent / totalDays) * 100 : 0,
                    monthlyPercentage: Math.max(0, monthlyPercentage),
                });

                setMonthlyChartData(Array.from(chartDataMap.values()));
            }
        });
    }

    const requestsRef = ref(db, 'leaveRequests');
    onValue(requestsRef, (snapshot) => {
        if (snapshot.exists()) {
            const allRequests: Record<string, Omit<LeaveRequest, 'id'>> = snapshot.val();
            const userRequests = Object.entries(allRequests)
                .filter(([, req]) => req.studentId === userProfile.uid)
                .map(([id, req]) => ({ ...req, id }));
            setLeaveRequests(userRequests.reverse());
        } else {
            setLeaveRequests([]);
        }
    });

  }, [userProfile, attendanceSettings]);
  
  const handleOpenDialog = (request: LeaveRequest | null) => {
    setEditingRequest(request);
    if (request) {
        const [year, month, day] = request.date.split('-').map(Number);
        setLeaveDate(new Date(year, month - 1, day));
        setLeaveReason(request.reason);
    } else {
        setLeaveDate(undefined);
        setLeaveReason('');
    }
    setIsLeaveDialogOpen(true);
  }

  const handleLeaveRequest = async () => {
    if (!user || !userProfile) {
        toast({ title: "Error", description: "You must be logged in to submit a request.", variant: "destructive" });
        return;
    }

    if (!leaveDate || !leaveReason) {
        toast({ title: "Error", description: "Please select a date and provide a reason.", variant: "destructive" });
        return;
    }
    if (!userProfile.admissionNo || !userProfile.courseId) {
        toast({ title: "Error", description: "Your profile is incomplete. Please update your admission number and course.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const formattedDate = format(leaveDate, "yyyy-MM-dd");

    try {
        const requestData: Omit<LeaveRequest, 'id'> = {
            studentId: userProfile.uid,
            studentName: userProfile.name,
            studentAdmissionNo: userProfile.admissionNo,
            date: formattedDate,
            reason: leaveReason,
            status: 'pending',
            courseId: userProfile.courseId
        };
        
        if(editingRequest) {
            const requestRef = ref(db, `leaveRequests/${editingRequest.id}`);
            await update(requestRef, requestData);
            toast({ title: "Success", description: "Leave request updated." });
        } else {
            const newRequestRef = push(ref(db, 'leaveRequests'));
            await set(newRequestRef, requestData);
            toast({ title: "Success", description: "Leave request submitted." });
        }
        setIsLeaveDialogOpen(false);
    } catch (error: any) {
      console.error("Leave Request Error: ", error);
      toast({ title: "Error", description: error.message || "Failed to process leave request.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteRequest = async (requestId: string) => {
    if(window.confirm("Are you sure you want to delete this leave request?")) {
        try {
            await remove(ref(db, `leaveRequests/${requestId}`));
            toast({ title: "Success", description: "Leave request deleted." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete request.", variant: "destructive" });
        }
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
        case 'approved': return 'default';
        case 'rejected': return 'destructive';
        case 'pending': return 'secondary';
        default: return 'outline';
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="font-headline text-2xl">Welcome, {userProfile?.name}!</CardTitle>
            <CardDescription>Here is your attendance summary for {course?.name}.</CardDescription>
          </div>
           <Button onClick={() => handleOpenDialog(null)}>Request Absence</Button>
        </CardHeader>
        <CardContent className="grid gap-6">
            <div className="space-y-2">
                <div className="flex justify-between font-mono text-sm">
                    <span>This Month's Attendance</span>
                    <span>{attendance.monthlyPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={attendance.monthlyPercentage} />
                <div className="text-xs text-muted-foreground">
                    You need at least {attendanceSettings.examEligibilityThreshold}% to be eligible for exams.
                </div>
            </div>
             <div className="grid grid-cols-2 gap-4 text-center">
                 <div className="p-4 bg-blue-100/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">{attendance.totalPercentage.toFixed(1)}%</p>
                    <p className="text-sm font-medium text-muted-foreground">Overall Attendance</p>
                </div>
                <div className={`p-4 rounded-lg ${attendance.monthlyPercentage >= attendanceSettings.examEligibilityThreshold ? 'bg-green-100/50' : 'bg-red-100/50'}`}>
                    <p className={`text-2xl font-bold ${attendance.monthlyPercentage >= attendanceSettings.examEligibilityThreshold ? 'text-green-700' : 'text-red-700'}`}>
                        {attendance.monthlyPercentage >= attendanceSettings.examEligibilityThreshold ? 'Eligible' : 'Not Eligible'}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">Exam Status</p>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Monthly Attendance Report</CardTitle>
            <CardDescription>Your attendance record over the last few months.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="#22c55e" name="Present" />
                <Bar dataKey="halfDay" fill="#f59e0b" name="Half-day" />
                <Bar dataKey="absent" fill="#ef4444" name="Absent" />
                </BarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>
      
       <Card>
          <CardHeader>
            <CardTitle>My Leave Requests</CardTitle>
            <CardDescription>View and manage your absence requests.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.length > 0 ? leaveRequests.map(req => (
                    <TableRow key={req.id}>
                        <TableCell>{req.date}</TableCell>
                        <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status}</Badge></TableCell>
                        <TableCell className="text-right">
                            {req.status === 'pending' && (
                                <>
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(req)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteRequest(req.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center">No leave requests found.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
      </Card>

      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRequest ? 'Edit Absence Request' : 'Request Absence'}</DialogTitle>
            <DialogDescription>Select a date and provide a reason for your absence.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <input type="date" value={leaveDate ? format(leaveDate, 'yyyy-MM-dd') : ''} onChange={(e) => setLeaveDate(e.target.valueAsDate || undefined)} className="rounded-md border p-2" />
            <Textarea placeholder="Type your reason here..." value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleLeaveRequest} disabled={isSubmitting || !leaveDate || !leaveReason}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting...</> : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
