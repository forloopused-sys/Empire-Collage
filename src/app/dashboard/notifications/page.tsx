

"use client";

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth-provider';
import { Notification, Course, UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, BellRing, Edit, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatDistanceToNow } from 'date-fns';

const notificationSchema = z.object({
    message: z.string().min(5, "Message must be at least 5 characters."),
    imageUrl: z.string().url().optional().or(z.literal('')),
    videoUrl: z.string().url().optional().or(z.literal('')),
    recipientRole: z.enum(['all', 'students', 'teachers']),
    recipientCourseId: z.string().optional() // For teachers sending to their class
});

export default function NotificationsPage() {
    const { user, userProfile, markAllNotificationsAsRead } = useAuth();
    const { toast } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [allUsers, setAllUsers] = useState<Record<string, UserProfile>>({});
    const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
    
    const form = useForm<z.infer<typeof notificationSchema>>({
        resolver: zodResolver(notificationSchema),
        defaultValues: { message: '', imageUrl: '', videoUrl: '', recipientRole: 'all', recipientCourseId: '' }
    });

    useEffect(() => {
        markAllNotificationsAsRead();
    }, [markAllNotificationsAsRead]);

     useEffect(() => {
        const usersRef = ref(db, 'users');
        const unsubscribeUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                setAllUsers(snapshot.val());
            }
        });
        return () => unsubscribeUsers();
    }, []);

    useEffect(() => {
        const coursesRef = ref(db, 'courses');
        const unsubscribeCourses = onValue(coursesRef, (snapshot) => {
            if (snapshot.exists()) {
                const allCourses: Course[] = Object.entries(snapshot.val()).map(([id, data]: any) => ({ id, ...data }));
                if (userProfile?.role === 'admin') {
                    setCourses(allCourses);
                } else if (userProfile?.role === 'teacher') {
                    const teacherCourses = allCourses.filter(c => userProfile.assignedCourses?.includes(c.id));
                    setCourses(teacherCourses);
                }
            }
        });
        return () => unsubscribeCourses();
    }, [userProfile]);

    useEffect(() => {
        const notificationsRef = ref(db, 'notifications');
        const unsubscribe = onValue(notificationsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const allNotifs: Notification[] = Object.keys(data).map(key => ({ ...data[key], id: key }));
                
                const filteredNotifs = allNotifs.filter(n => {
                    if (!userProfile) return false;
                    if (userProfile.role === 'admin') return true;
                    if (n.recipientRole === 'all') return true;
                    if (n.recipientRole === userProfile.role) {
                        if (userProfile.role === 'student' && n.recipientCourseId) {
                            return n.recipientCourseId === userProfile.courseId;
                        }
                         if (userProfile.role === 'teacher' && n.recipientCourseId) {
                            return userProfile.assignedCourses?.includes(n.recipientCourseId);
                        }
                        return true;
                    }
                    return false;
                }).sort((a, b) => b.timestamp - a.timestamp);

                setNotifications(filteredNotifs);
            } else {
                 setNotifications([]);
            }
        });

        return () => unsubscribe();
    }, [userProfile]);
    
    const handleRead = (notificationId: string) => {
        if (!user) return;
        const readRef = ref(db, `notifications/${notificationId}/readBy/${user.uid}`);
        set(readRef, true);
    }
    
    const openDialog = (notif: Notification | null) => {
        setEditingNotification(notif);
        if (notif) {
            // Ensure recipientRole matches form enum
            const recipientRole = ['all', 'students', 'teachers'].includes(notif.recipientRole) ? (notif.recipientRole as any) : 'all';
            form.reset({
                message: notif.message,
                imageUrl: notif.imageUrl || '',
                videoUrl: notif.videoUrl || '',
                recipientRole,
                recipientCourseId: notif.recipientCourseId || ''
            });
        } else {
            form.reset({ message: '', imageUrl: '', videoUrl: '', recipientRole: 'all', recipientCourseId: '' });
        }
        setIsDialogOpen(true);
    };

    const onSubmit = async (values: z.infer<typeof notificationSchema>) => {
        if (!user || !userProfile) {
            toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
            return;
        }
        setIsSubmitting(true);
        try {
            const data: Partial<Omit<Notification, 'id' | 'timestamp' | 'readBy'>> = {
                message: values.message,
                senderId: user.uid,
                senderName: userProfile.name,
                senderRole: userProfile.role,
                recipientRole: values.recipientRole,
            };

            if (values.imageUrl) data.imageUrl = values.imageUrl;
            if (values.videoUrl) data.videoUrl = values.videoUrl;
            
            if (userProfile.role === 'teacher') {
                data.recipientRole = 'students';
                data.recipientCourseId = values.recipientCourseId;
            } else if (userProfile.role === 'admin') {
                 if (values.recipientRole === 'students' && values.recipientCourseId) {
                    data.recipientCourseId = values.recipientCourseId;
                } else {
                    delete data.recipientCourseId;
                }
            }
            
            if (editingNotification) {
                const notifRef = ref(db, `notifications/${editingNotification.id}`);
                await update(notifRef, data);
                toast({ title: 'Success', description: 'Notification updated!' });
            } else {
                const newNotifRef = push(ref(db, 'notifications'));
                const fullData = { ...data, timestamp: Date.now() };
                await set(newNotifRef, fullData);
                toast({ title: 'Success', description: 'Notification sent!' });
            }
            
            setIsDialogOpen(false);
        } catch (error: any) {
            console.error("Notification submit error:", error);
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
     const handleDelete = async (notificationId: string) => {
        if (window.confirm('Are you sure you want to delete this notification?')) {
            try {
                await remove(ref(db, `notifications/${notificationId}`));
                toast({ title: 'Success', description: 'Notification deleted.' });
            } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
            }
        }
    };

    const canManageNotification = (notif: Notification): boolean => {
        if (!userProfile || !user) return false;
        if (userProfile.role === 'admin') return true;
        if (userProfile.role === 'teacher' && notif.senderId === user.uid) return true;
        return false;
    }
    
    const canSendNotification = userProfile?.role === 'admin' || userProfile?.role === 'teacher';

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Notifications</CardTitle>
                        <CardDescription>Stay updated with the latest announcements.</CardDescription>
                    </div>
                    {canSendNotification && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-1" onClick={() => openDialog(null)}>
                                    <PlusCircle className="h-3.5 w-3.5" />
                                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                        New Notification
                                    </span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>{editingNotification ? 'Edit Notification' : 'Send New Notification'}</DialogTitle>
                                </DialogHeader>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                        <FormField control={form.control} name="message" render={({ field }) => (
                                            <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea placeholder="Enter your message..." {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="imageUrl" render={({ field }) => (
                                            <FormItem><FormLabel>Image URL (Optional)</FormLabel><FormControl><Input placeholder="https://example.com/image.png" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="videoUrl" render={({ field }) => (
                                            <FormItem><FormLabel>Video URL (Optional)</FormLabel><FormControl><Input placeholder="https://example.com/video.mp4" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        
                                        {userProfile?.role === 'admin' && (
                                            <FormField control={form.control} name="recipientRole" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Recipient</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Select recipients"/></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="all">All Users</SelectItem>
                                                            <SelectItem value="students">Students Only</SelectItem>
                                                            <SelectItem value="teachers">Teachers Only</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage/>
                                                </FormItem>
                                            )} />
                                        )}
                                        
                                         {(userProfile?.role === 'admin' && form.watch('recipientRole') === 'students') && (
                                            <FormField control={form.control} name="recipientCourseId" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Target Specific Class (Optional)</FormLabel>
                                                     <Select onValueChange={field.onChange} value={field.value || ''}>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="All Classes"/></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="">All Classes</SelectItem>
                                                            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormDescription>Send to all students or only those in a selected class.</FormDescription>
                                                    <FormMessage/>
                                                </FormItem>
                                            )} />
                                        )}

                                        {userProfile?.role === 'teacher' && (
                                             <FormField control={form.control} name="recipientCourseId" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Send to Class</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value} required>
                                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a class"/></SelectTrigger></FormControl>
                                                        <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                    <FormDescription>This notification will be sent to all students in the selected class.</FormDescription>
                                                    <FormMessage/>
                                                </FormItem>
                                            )} />
                                        )}

                                        <DialogFooter>
                                            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                            <Button type="submit" disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </Form>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    {notifications.length > 0 ? (
                        notifications.map(notif => (
                            <Card key={notif.id} className={`p-4 relative ${!notif.readBy?.[user!.uid] && 'bg-primary/5 border-primary/20'}`} onClick={() => handleRead(notif.id)}>
                                 <div className="flex items-start gap-4">
                                     <div className="relative">
                                         <div className="bg-primary/10 p-2 rounded-full"><BellRing className="h-5 w-5 text-primary"/></div>
                                         {notif.senderRole && (
                                             <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ${notif.senderRole === 'admin' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                         )}
                                     </div>
                                     <div className="flex-1">
                                         <p className="font-semibold">{notif.senderName}</p>
                                         <p className="text-sm text-muted-foreground">{notif.message}</p>
                                        {notif.imageUrl && <img src={notif.imageUrl} alt="Notification Image" className="mt-2 rounded-lg max-h-60 w-auto"/>}
                                        {notif.videoUrl && <video src={notif.videoUrl} controls className="mt-2 rounded-lg max-h-60 w-auto"/>}
                                        <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}</p>
                                    </div>
                                </div>
                                {canManageNotification(notif) && (
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openDialog(notif);}}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                         <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(notif.id);}}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <p>No notifications yet.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
