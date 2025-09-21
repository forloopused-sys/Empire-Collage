
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth-provider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ref, update, onValue } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Course } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
  name: z.string().min(2, { message: "Name is too short." }),
  admissionNo: z.string().optional(),
  courseId: z.string().optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword']
});

const emailSchema = z.object({
    newEmail: z.string().email('Invalid email address.'),
    password: z.string().min(1, 'Password is required to confirm change.')
});


export default function ProfilePage() {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      name: userProfile?.name || '',
      admissionNo: userProfile?.admissionNo || '',
      courseId: userProfile?.courseId || '',
    },
  });
  
  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: ''}
  });
  
   const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: userProfile?.email || '', password: ''}
  });
  
  useEffect(() => {
    const coursesRef = ref(db, 'courses');
    const unsubscribe = onValue(coursesRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            setCourses(Object.keys(data).map(key => ({ id: key, ...data[key] })));
        }
    });
    return () => unsubscribe();
  }, []);
  
   useEffect(() => {
    if (userProfile) {
      emailForm.reset({ newEmail: userProfile.email, password: '' });
    }
  }, [userProfile, emailForm]);

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!userProfile) return;
    setIsSubmittingProfile(true);
    try {
      const userRef = ref(db, `users/${userProfile.uid}`);
      const updates: any = { name: values.name };
      
      if(userProfile.role === 'student') {
        updates.admissionNo = values.admissionNo;
        updates.courseId = values.courseId;
      }
      
      await update(userRef, updates);
      toast({ title: "Success", description: "Profile updated successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    if (!user || !user.email) return;
    setIsSubmittingPassword(true);
    
    try {
        const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, values.newPassword);
        
        toast({ title: "Success", description: "Password updated successfully." });
        passwordForm.reset();
    } catch(error: any) {
        let errorMessage = "Failed to update password.";
        if (error.code === 'auth/wrong-password') {
            errorMessage = "The current password you entered is incorrect.";
        }
        console.error("Password Update Error:", error);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmittingPassword(false);
    }
  };
  
  const onEmailSubmit = async (values: z.infer<typeof emailSchema>) => {
    if (!user || !user.email) return;
    setIsSubmittingEmail(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, values.password);
      await reauthenticateWithCredential(user, credential);
      await verifyBeforeUpdateEmail(user, values.newEmail);

      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, { email: values.newEmail });
      
      toast({
        title: "Verification Email Sent",
        description: `A verification link has been sent to ${values.newEmail}. Please check your inbox to complete the email change.`,
        duration: 9000,
      });
      emailForm.reset({ newEmail: values.newEmail, password: ''});

    } catch (error: any) {
      let errorMessage = "Failed to update email.";
      if (error.code === 'auth/wrong-password') {
        errorMessage = "The password you entered is incorrect.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already in use by another account.";
      }
      console.error("Email Update Error:", error);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmittingEmail(false);
    }
  };


  return (
    <div className="max-w-2xl mx-auto space-y-6">
        <Card>
        <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>Update your personal information here.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                <FormField
                control={profileForm.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                {userProfile?.role === 'student' && (
                <>
                    <FormField
                        control={profileForm.control}
                        name="admissionNo"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Admission Number</FormLabel>
                            <FormControl>
                            <Input placeholder="Your admission number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={profileForm.control}
                        name="courseId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Course</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select a course" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </>
                )}
                <div className="flex items-center gap-4">
                    <p className="text-sm font-medium">Role</p>
                    <p className="text-sm text-muted-foreground capitalize">{userProfile?.role}</p>
                </div>


                <Button type="submit" disabled={isSubmittingProfile}>
                {isSubmittingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
                </Button>
            </form>
            </Form>
        </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Change Email</CardTitle>
                <CardDescription>Update your account email address.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                        <FormField control={emailForm.control} name="newEmail" render={({field}) => (
                             <FormItem>
                                <FormLabel>New Email</FormLabel>
                                <FormControl><Input type="email" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={emailForm.control} name="password" render={({field}) => (
                             <FormItem>
                                <FormLabel>Confirm with Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <Button type="submit" disabled={isSubmittingEmail}>
                            {isSubmittingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Request Email Change
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                        <FormField control={passwordForm.control} name="currentPassword" render={({field}) => (
                             <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={passwordForm.control} name="newPassword" render={({field}) => (
                             <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={passwordForm.control} name="confirmPassword" render={({field}) => (
                             <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl><Input type="password" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <Button type="submit" disabled={isSubmittingPassword}>
                            {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}

    
