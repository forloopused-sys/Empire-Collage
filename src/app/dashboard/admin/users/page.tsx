

"use client";

import { useState, useEffect } from 'react';
import { ref, onValue, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserProfile, Course } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2, Loader2, PlusCircle, UserCog } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { createUser } from '@/actions/users';

const editUserSchema = z.object({
  name: z.string().min(2),
  role: z.enum(['student', 'teacher', 'admin', 'sub-admin']),
  admissionNo: z.string().optional(),
  courseId: z.string().optional(),
  assignedCourses: z.array(z.string()).optional(),
});


const studentCreateSchema = z.object({
    name: z.string().min(2, { message: 'Name is required' }),
    admissionNo: z.string().min(1, { message: 'Admission number is required' }),
    email: z.string().email({ message: 'A valid email is required' }),
    courseId: z.string().min(1, { message: 'Course selection is required' }),
});

const teacherCreateSchema = z.object({
    name: z.string().min(2, { message: 'Name is required' }),
    email: z.string().email({ message: 'A valid email is required' }),
    assignedCourses: z.array(z.string()).min(1, 'At least one course must be assigned.'),
});

const adminCreateSchema = z.object({
    name: z.string().min(2, { message: 'Name is required' }),
    email: z.string().email({ message: 'A valid email is required' }),
});

const subAdminCreateSchema = z.object({
    name: z.string().min(2, { message: 'Name is required' }),
    email: z.string().email({ message: 'A valid email is required' }),
});


export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const editForm = useForm<z.infer<typeof editUserSchema>>({ resolver: zodResolver(editUserSchema) });
  
  const studentCreateForm = useForm<z.infer<typeof studentCreateSchema>>({ 
    resolver: zodResolver(studentCreateSchema),
    defaultValues: { name: '', email: '', admissionNo: '', courseId: '' },
  });
  const teacherCreateForm = useForm<z.infer<typeof teacherCreateSchema>>({ 
    resolver: zodResolver(teacherCreateSchema),
    defaultValues: { name: '', email: '', assignedCourses: [] },
  });
  const adminCreateForm = useForm<z.infer<typeof adminCreateSchema>>({
    resolver: zodResolver(adminCreateSchema),
    defaultValues: { name: '', email: '' }
  });
  const subAdminCreateForm = useForm<z.infer<typeof subAdminCreateSchema>>({
    resolver: zodResolver(subAdminCreateSchema),
    defaultValues: { name: '', email: '' }
  });

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const usersUnsubscribe = onValue(usersRef, (snapshot) => {
      setIsLoading(true);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        setUsers(Object.keys(usersData).map(uid => ({...usersData[uid], uid})));
      } else {
        setUsers([]);
      }
      setIsLoading(false);
    });
    
    const coursesRef = ref(db, 'courses');
    const coursesUnsubscribe = onValue(coursesRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            setCourses(Object.keys(data).map(key => ({ id: key, ...data[key] })));
        }
    });

    return () => {
        usersUnsubscribe();
        coursesUnsubscribe();
    };
  }, []);

  const openEditDialog = (user: UserProfile) => {
    setEditingUser(user);
    const role = ['student', 'teacher', 'admin', 'sub-admin'].includes(user.role) ? (user.role as any) : 'student';
    editForm.reset({
      name: user.name,
      role,
      admissionNo: user.admissionNo,
      courseId: user.courseId,
      assignedCourses: user.assignedCourses || [],
    });
    setIsEditDialogOpen(true);
  };
  
  const handleDelete = (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone and will remove the user from the system.')) {
        remove(ref(db, `users/${userId}`))
        .then(() => toast({ title: 'Success', description: 'User data deleted.' }))
        .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }));
    }
  };

  const onEditSubmit = (values: z.infer<typeof editUserSchema>) => {
    if (!editingUser) return;
    setIsSubmitting(true);
    
    const updates: Partial<UserProfile> = {
      name: values.name,
      role: values.role
    };

    if (values.role === 'student') {
      updates.admissionNo = values.admissionNo;
      updates.courseId = values.courseId;
      updates.assignedCourses = []; // Clear assigned courses if switched to student
    } else if (values.role === 'teacher') {
      updates.assignedCourses = values.assignedCourses;
      updates.admissionNo = ''; // Clear student-specific fields
      updates.courseId = '';
    }

    update(ref(db, `users/${editingUser.uid}`), updates)
      .then(() => {
        toast({ title: 'Success', description: 'User updated.' });
        setIsEditDialogOpen(false);
      })
      .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
      .finally(() => setIsSubmitting(false));
  };

  const onStudentCreateSubmit = async (values: z.infer<typeof studentCreateSchema>) => {
      setIsSubmitting(true);
      const result = await createUser({ ...values, role: 'student' });
      if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
          toast({ title: 'Success', description: 'Student created successfully.' });
          studentCreateForm.reset();
          setIsAddDialogOpen(false);
      }
      setIsSubmitting(false);
  };

  const onTeacherCreateSubmit = async (values: z.infer<typeof teacherCreateSchema>) => {
      setIsSubmitting(true);
      const result = await createUser({ ...values, role: 'teacher' });
       if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
          toast({ title: 'Success', description: 'Teacher created successfully.' });
          teacherCreateForm.reset();
          setIsAddDialogOpen(false);
      }
      setIsSubmitting(false);
  };

  const onAdminCreateSubmit = async (values: z.infer<typeof adminCreateSchema>) => {
      setIsSubmitting(true);
      const result = await createUser({ ...values, role: 'admin' });
       if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
          toast({ title: 'Success', description: 'Admin created successfully.' });
          adminCreateForm.reset();
          setIsAddDialogOpen(false);
      }
      setIsSubmitting(false);
  };
  
  const onSubAdminCreateSubmit = async (values: z.infer<typeof subAdminCreateSchema>) => {
      setIsSubmitting(true);
      const result = await createUser({ ...values, role: 'sub-admin' });
       if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
      } else {
          toast({ title: 'Success', description: 'Sub-admin created successfully.' });
          subAdminCreateForm.reset();
          setIsAddDialogOpen(false);
      }
      setIsSubmitting(false);
  };

  
  const students = users.filter(u => u.role === 'student');
  const teachers = users.filter(u => u.role === 'teacher');
  const admins = users.filter(u => u.role === 'admin' || u.role === 'sub-admin');
  
  const getCourseName = (courseId?: string) => courses.find(c => c.id === courseId)?.name || 'N/A';

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View, edit, and manage all users.</CardDescription>
        </div>
         <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Add User
                    </span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>Create a new student, teacher, or admin account.</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="student">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="student">Student</TabsTrigger>
                        <TabsTrigger value="teacher">Teacher</TabsTrigger>
                        <TabsTrigger value="sub-admin">Sub-Admin</TabsTrigger>
                        <TabsTrigger value="admin">Admin</TabsTrigger>
                    </TabsList>
                    <TabsContent value="student">
                        <Form {...studentCreateForm}>
                            <form onSubmit={studentCreateForm.handleSubmit(onStudentCreateSubmit)} className="space-y-4 pt-4">
                                <FormField control={studentCreateForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Student's full name" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={studentCreateForm.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="student@example.com" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={studentCreateForm.control} name="admissionNo" render={({ field }) => <FormItem><FormLabel>Admission No.</FormLabel><FormControl><Input {...field} placeholder="e.g., ECS24001"/></FormControl><FormMessage /></FormItem>} />
                                <FormField control={studentCreateForm.control} name="courseId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Course</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select a course"/></SelectTrigger></FormControl>
                                            <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage/>
                                    </FormItem>
                                )} />
                                <p className="text-xs text-muted-foreground">The default password for the new user will be `OnlineEmpire@123`.</p>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Create Student'}</Button></DialogFooter>
                            </form>
                        </Form>
                    </TabsContent>
                    <TabsContent value="teacher">
                        <Form {...teacherCreateForm}>
                            <form onSubmit={teacherCreateForm.handleSubmit(onTeacherCreateSubmit)} className="space-y-4 pt-4">
                                <FormField control={teacherCreateForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Teacher's full name" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={teacherCreateForm.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="teacher@example.com" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={teacherCreateForm.control} name="assignedCourses"
                                    render={() => (
                                    <FormItem>
                                        <div className="mb-4"><FormLabel>Assigned Courses</FormLabel></div>
                                        {courses.map((course) => (
                                        <FormField key={course.id} control={teacherCreateForm.control} name="assignedCourses"
                                            render={({ field }) => {
                                            return (
                                                <FormItem key={course.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(course.id)}
                                                        onCheckedChange={(checked) => {
                                                            return checked
                                                            ? field.onChange([...(field.value || []), course.id])
                                                            : field.onChange(field.value?.filter((value) => value !== course.id))
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">{course.name}</FormLabel>
                                                </FormItem>
                                            )
                                            }}
                                        />
                                        ))}
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                <p className="text-xs text-muted-foreground">The default password for the new user will be `OnlineEmpire@123`.</p>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Create Teacher'}</Button></DialogFooter>
                            </form>
                        </Form>
                    </TabsContent>
                    <TabsContent value="sub-admin">
                        <Form {...subAdminCreateForm}>
                            <form onSubmit={subAdminCreateForm.handleSubmit(onSubAdminCreateSubmit)} className="space-y-4 pt-4">
                                <FormField control={subAdminCreateForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Sub-admin's full name" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={subAdminCreateForm.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="subadmin@example.com" /></FormControl><FormMessage /></FormItem>} />
                                <p className="text-xs text-muted-foreground">The default password for the new user will be `OnlineEmpire@123`.</p>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Create Sub-Admin'}</Button></DialogFooter>
                            </form>
                        </Form>
                    </TabsContent>
                     <TabsContent value="admin">
                        <Form {...adminCreateForm}>
                            <form onSubmit={adminCreateForm.handleSubmit(onAdminCreateSubmit)} className="space-y-4 pt-4">
                                <FormField control={adminCreateForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} placeholder="Admin's full name" /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={adminCreateForm.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" placeholder="admin@example.com" /></FormControl><FormMessage /></FormItem>} />
                                <p className="text-xs text-muted-foreground">The default password for the new user will be `OnlineEmpire@123`.</p>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Create Admin'}</Button></DialogFooter>
                            </form>
                        </Form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="students">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
            <TabsTrigger value="teachers">Teachers ({teachers.length})</TabsTrigger>
            <TabsTrigger value="admins">Admins ({admins.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="students">
            <UserTable users={students} onEdit={openEditDialog} onDelete={handleDelete} getCourseName={getCourseName} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="teachers">
            <UserTable users={teachers} onEdit={openEditDialog} onDelete={handleDelete} getCourseName={getCourseName} isLoading={isLoading} courses={courses} />
          </TabsContent>
          <TabsContent value="admins">
            <UserTable users={admins} onEdit={openEditDialog} onDelete={handleDelete} getCourseName={getCourseName} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {editingUser?.name}</DialogTitle>
              <DialogDescription>Update user details.</DialogDescription>
            </DialogHeader>
            
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                  <FormField control={editForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                  
                  <FormField
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={editingUser?.role === 'admin' || editingUser?.role === 'sub-admin'}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="teacher">Teacher</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage/>
                      </FormItem>
                    )}
                  />

                  {editForm.watch('role') === 'student' && (
                    <>
                      <FormField control={editForm.control} name="admissionNo" render={({ field }) => <FormItem><FormLabel>Admission No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                      <FormField control={editForm.control} name="courseId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Course</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage/>
                        </FormItem>
                      )} />
                    </>
                  )}
                  {editForm.watch('role') === 'teacher' && (
                    <FormField
                      control={editForm.control}
                      name="assignedCourses"
                      render={() => (
                        <FormItem>
                          <div className="mb-4"><FormLabel>Assigned Courses</FormLabel></div>
                          {courses.map((course) => (
                            <FormField
                              key={course.id}
                              control={editForm.control}
                              name="assignedCourses"
                              render={({ field }) => (
                                <FormItem key={course.id} className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(course.id)}
                                      onCheckedChange={(checked) => (
                                        checked
                                          ? field.onChange([...(field.value || []), course.id])
                                          : field.onChange(field.value?.filter((value) => value !== course.id))
                                      )}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">{course.name}</FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {(editingUser?.role === 'admin' || editingUser?.role === 'sub-admin') && (
                    <p className="text-sm text-muted-foreground">Admin and sub-admin roles cannot be changed from this panel.</p>
                  )}

                  <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save'}</Button></DialogFooter>
                </form>
              </Form>
          </DialogContent>
        </Dialog>
    </Card>
    </>
  );
}

function UserTable({ users, onEdit, onDelete, getCourseName, isLoading, courses }: { users: UserProfile[], onEdit: (user: UserProfile) => void, onDelete: (userId: string) => void, getCourseName: (id?: string) => string, isLoading: boolean, courses?: Course[] }) {
  const isStudentTable = users.some(u => u.role === 'student');
  const isTeacherTable = users.some(u => u.role === 'teacher');
  const isAdminTable = users.some(u => u.role === 'admin' || u.role === 'sub-admin');
  
  const tableHeaders:string[] = [ "Name", "Email" ];

  if(isStudentTable) tableHeaders.push('Adm No', 'Course');
  if(isTeacherTable) tableHeaders.push('Assigned Courses');
  if(isAdminTable) tableHeaders.push('Role');
  
  tableHeaders.push("Actions");

  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {tableHeaders.map((header) => (
            <TableHead key={header} className={header === "Actions" ? "text-right" : ""}>
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow><TableCell colSpan={tableHeaders.length} className="text-center">Loading...</TableCell></TableRow>
        ) : users.length > 0 ? (
          users.map((user) => (
            <TableRow key={user.uid}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
               {user.role === 'student' && (
                <>
                  <TableCell>{user.admissionNo}</TableCell>
                  <TableCell>{getCourseName(user.courseId)}</TableCell>
                </>
              )}
               {user.role === 'teacher' && <TableCell>{user.assignedCourses?.map(getCourseName).join(', ') || 'None'}</TableCell>}
               {(user.role === 'admin' || user.role === 'sub-admin') && (
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <UserCog className="h-5 w-5 inline-block text-primary" />
                      <span className='capitalize'>{user.role}</span>
                    </div>
                  </TableCell>
               )}
              <TableCell className="text-right">
                 <Button variant="ghost" size="icon" onClick={() => onEdit(user)}><Edit className="h-4 w-4" /></Button>
                 {user.role !== 'admin' && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(user.uid)}><Trash2 className="h-4 w-4" /></Button>}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow><TableCell colSpan={tableHeaders.length} className="text-center">No users found.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  )
}
