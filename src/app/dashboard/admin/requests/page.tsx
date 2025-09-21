
"use client";

import { useState, useEffect } from "react";
import { ref, onValue, update, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth-provider";
import { UserProfile, Course, LeaveRequest } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardX, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function AdminLeaveRequestsPage() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    if (userProfile?.role === "admin") {
      const leaveRequestsRef = ref(db, 'leaveRequests');
      onValue(leaveRequestsRef, (snapshot) => {
        if(snapshot.exists()) {
            const allRequests: Record<string, Omit<LeaveRequest, 'id'>> = snapshot.val();
            const requestsList = Object.entries(allRequests).map(([id, request]) => ({ ...request, id }));
            setLeaveRequests(requestsList.reverse()); // Show newest first
        } else {
            setLeaveRequests([]);
        }
      });
    }
  }, [userProfile]);

  
  const handleRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    const requestRef = ref(db, `leaveRequests/${requestId}`);
    try {
        await update(requestRef, { status });

        if (status === 'approved') {
            const request = leaveRequests.find(r => r.id === requestId);
            if (request) {
                const studentSnapshot = await get(ref(db, `users/${request.studentId}`));
                if (studentSnapshot.exists()) {
                    const student = studentSnapshot.val() as UserProfile;
                    if(student.courseId) {
                        const attendanceRef = ref(db, `attendance/${student.courseId}/${request.date}`);
                        await update(attendanceRef, { [request.studentId]: 'absent' });
                    }
                }
            }
        }
        toast({ title: 'Success', description: `Request ${status}.` });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to update request.', variant: 'destructive' });
    }
  };
  
  const pendingRequests = leaveRequests.filter(r => r.status === 'pending');
  const approvedRequests = leaveRequests.filter(r => r.status === 'approved');
  const rejectedRequests = leaveRequests.filter(r => r.status === 'rejected');


  return (
    <Card>
        <CardHeader>
            <CardTitle>Leave Requests</CardTitle>
            <CardDescription>Review and manage all student leave requests across the institution.</CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
                    <TabsTrigger value="approved">Approved ({approvedRequests.length})</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected ({rejectedRequests.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                    <LeaveRequestTable requests={pendingRequests} onStatusChange={handleRequestStatus} />
                </TabsContent>
                <TabsContent value="approved">
                    <LeaveRequestTable requests={approvedRequests} onStatusChange={handleRequestStatus} />
                </TabsContent>
                <TabsContent value="rejected">
                    <LeaveRequestTable requests={rejectedRequests} onStatusChange={handleRequestStatus} />
                </TabsContent>
            </Tabs>
        </CardContent>
    </Card>
  );
}


function LeaveRequestTable({ requests, onStatusChange }: { requests: LeaveRequest[], onStatusChange: (id: string, status: 'approved' | 'rejected') => void }) {
    
    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'approved': return 'default';
            case 'rejected': return 'destructive';
            case 'pending': return 'secondary';
            default: return 'outline';
        }
    };

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
                {requests.length > 0 ? requests.map(req => (
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
                        <TableCell colSpan={6} className="text-center">No leave requests found.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
