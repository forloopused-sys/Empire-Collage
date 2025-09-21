
"use client";

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Course } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Course name is required.' }),
  subjects: z.string().optional(),
});

export default function CoursesPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', subjects: '' },
  });

  useEffect(() => {
    const coursesRef = ref(db, 'courses');
    const unsubscribe = onValue(coursesRef, (snapshot) => {
      setIsLoading(true);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const coursesList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setCourses(coursesList);
      } else {
        setCourses([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    form.reset({
      name: course.name,
      subjects: course.subjects ? course.subjects.join(', ') : '',
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingCourse(null);
    form.reset({ name: '', subjects: '' });
    setIsDialogOpen(true);
  };

  const handleDelete = (courseId: string) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      remove(ref(db, `courses/${courseId}`))
        .then(() => toast({ title: 'Success', description: 'Course deleted.' }))
        .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }));
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const subjectsArray = values.subjects ? values.subjects.split(',').map(s => s.trim()).filter(s => s) : [];
    const courseData = {
      name: values.name,
      subjects: subjectsArray,
    };

    if (editingCourse) {
      update(ref(db, `courses/${editingCourse.id}`), courseData)
        .then(() => {
          toast({ title: 'Success', description: 'Course updated.' });
          setIsDialogOpen(false);
        })
        .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
        .finally(() => setIsSubmitting(false));
    } else {
      const newCourseRef = push(ref(db, 'courses'));
      set(newCourseRef, courseData)
        .then(() => {
          toast({ title: 'Success', description: 'Course added.' });
          setIsDialogOpen(false);
        })
        .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
        .finally(() => setIsSubmitting(false));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Courses</CardTitle>
          <CardDescription>Manage academic courses and their subjects.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={openNewDialog}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Add Course
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle>
              <DialogDescription>
                {editingCourse ? `Update the details for ${editingCourse.name}.` : 'Enter the details for the new course.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Bachelor of Computer Applications" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subjects"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subjects</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter subjects separated by commas, e.g., Maths, Science, History" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course Name</TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center">Loading...</TableCell></TableRow>
            ) : courses.length > 0 ? (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">{course.name}</TableCell>
                  <TableCell className="max-w-sm">
                    <div className="flex flex-wrap gap-1">
                      {course.subjects?.map(subject => (
                        <Badge key={subject} variant="secondary">{subject}</Badge>
                      )) || <span className="text-muted-foreground">No subjects</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(course)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(course.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={3} className="text-center">No courses found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
