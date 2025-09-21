
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ref, onValue, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth-provider';
import { AttendanceSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

const settingsSchema = z.object({
  absentPenalty: z.coerce.number().min(0, "Must be non-negative.").max(100, "Cannot exceed 100."),
  halfDayPenalty: z.coerce.number().min(0, "Must be non-negative.").max(100, "Cannot exceed 100."),
  examEligibilityThreshold: z.coerce.number().min(0, "Must be non-negative.").max(100, "Cannot exceed 100."),
});

export default function SettingsPage() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
        absentPenalty: 5,
        halfDayPenalty: 2.5,
        examEligibilityThreshold: 80,
    }
  });

  useEffect(() => {
    if (userProfile?.role !== 'admin') {
      toast({ title: "Access Denied", description: "You don't have permission to view this page.", variant: "destructive" });
      router.push('/dashboard');
      return;
    }
    
    const settingsRef = ref(db, 'settings/attendance');
    const unsubscribe = onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            form.reset(snapshot.val());
        }
    });

    return () => unsubscribe();
  }, [userProfile, router, toast, form]);

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    setIsSubmitting(true);
    try {
        const settingsRef = ref(db, 'settings/attendance');
        await set(settingsRef, values);
        toast({ title: 'Success', description: 'Attendance settings have been updated.' });
    } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (userProfile?.role !== 'admin') {
    return null; // or a loading/access denied component
  }

  return (
    <div className="max-w-2xl mx-auto">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-6 w-6" />
                    Attendance Settings
                </CardTitle>
                <CardDescription>
                    Manage rules for attendance calculation and exam eligibility.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="absentPenalty"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Absent Penalty (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 5" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="halfDayPenalty"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Half-Day Penalty (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 2.5" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="examEligibilityThreshold"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Exam Eligibility Threshold (%)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 80" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Settings
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
