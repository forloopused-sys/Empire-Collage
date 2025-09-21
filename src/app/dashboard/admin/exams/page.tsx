
"use client";

import { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth-provider';
import { Course, Exam, Question, Result } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Edit, Trash2, FileText, ChevronDown, BookOpen, Award } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"


const questionSchema = z.object({
    id: z.string().optional(),
    text: z.string().min(1, "Question text is required."),
    type: z.enum(['multiple-choice', 'short-answer', 'long-answer']),
    marks: z.coerce.number().min(1, "Marks must be at least 1."),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
});

const examSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Exam name is required."),
  description: z.string().optional(),
  courseId: z.string().min(1, "Please select a course."),
  startTime: z.string().min(1, "Start time is required."),
  endTime: z.string().min(1, "End time is required."),
  duration: z.coerce.number().min(1, "Duration must be at least 1 minute."),
  multipleAttempts: z.boolean().default(false),
  questions: z.array(questionSchema).optional(),
});


export default function ExamsPage() {
    const { toast } = useToast();
    const { userProfile } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
    const [editingExam, setEditingExam] = useState<Exam | null>(null);

    const examForm = useForm<z.infer<typeof examSchema>>({
        resolver: zodResolver(examSchema),
        defaultValues: {
            name: '',
            description: '',
            courseId: '',
            startTime: '',
            endTime: '',
            duration: 60,
            multipleAttempts: false,
        },
    });

    useEffect(() => {
        const coursesRef = ref(db, 'courses');
        const coursesUnsubscribe = onValue(coursesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const courseList: Course[] = Object.entries(data).map(([id, value]) => ({ id, ...(value as Omit<Course, 'id'>) }));
                if(userProfile?.role === 'teacher' && userProfile.assignedCourses) {
                    setCourses(courseList.filter(c => userProfile.assignedCourses?.includes(c.id)));
                } else {
                    setCourses(courseList);
                }
            }
        });
        
        const examsRef = ref(db, 'exams');
        const examsUnsubscribe = onValue(examsRef, (snapshot) => {
            setIsLoading(true);
            const data = snapshot.val();
            if (data) {
                const examList: Exam[] = Object.entries(data).map(([id, value]) => ({ id, ...(value as Omit<Exam, 'id'>) }));
                
                if(userProfile?.role === 'teacher' && userProfile.assignedCourses) {
                    setExams(examList.filter(e => userProfile.assignedCourses?.includes(e.courseId)));
                } else {
                     setExams(examList);
                }
            } else {
                setExams([]);
            }
            setIsLoading(false);
        });

        return () => {
            coursesUnsubscribe();
            examsUnsubscribe();
        };
    }, [userProfile]);

    useEffect(() => {
        if(editingExam) {
                // Normalize questions to the array shape expected by the form
                const normalizedQuestions = editingExam.questions
                    ? Array.isArray(editingExam.questions)
                      ? editingExam.questions
                      : Object.entries(editingExam.questions).map(([id, q]) => ({ id, ...(q as any) }))
                    : [];

                examForm.reset({
                    ...editingExam,
                    questions: normalizedQuestions,
                    startTime: editingExam.startTime ? new Date(editingExam.startTime).toISOString().slice(0, 16) : '',
                    endTime: editingExam.endTime ? new Date(editingExam.endTime).toISOString().slice(0, 16) : '',
                });
        } else {
            examForm.reset({
                name: '',
                description: '',
                courseId: '',
                startTime: '',
                endTime: '',
                duration: 60,
                multipleAttempts: false,
            });
        }
    }, [editingExam, examForm, isExamDialogOpen]);

    const openExamDialog = (exam: Exam | null) => {
        setEditingExam(exam);
        setIsExamDialogOpen(true);
    };

    const handleExamSubmit = (values: z.infer<typeof examSchema>) => {
        setIsSubmitting(true);
        const examData = {
            ...values,
            startTime: new Date(values.startTime).toISOString(),
            endTime: new Date(values.endTime).toISOString(),
        };

        if (editingExam) {
            update(ref(db, `exams/${editingExam.id}`), examData)
                .then(() => {
                    toast({ title: 'Success', description: 'Exam updated.' });
                    setIsExamDialogOpen(false);
                })
                .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
                .finally(() => setIsSubmitting(false));
        } else {
            const newExamRef = push(ref(db, 'exams'));
            set(newExamRef, examData)
                .then(() => {
                    toast({ title: 'Success', description: 'Exam created.' });
                    setIsExamDialogOpen(false);
                })
                .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
                .finally(() => setIsSubmitting(false));
        }
    };
    
    const handleDeleteExam = (examId: string) => {
        if (window.confirm('Are you sure you want to delete this exam? All questions and results will be lost.')) {
            remove(ref(db, `exams/${examId}`))
            .then(() => {
                toast({ title: 'Success', description: 'Exam deleted.' });
            })
            .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }));
        }
    };

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2"><FileText /> Manage Exams</CardTitle>
                        <CardDescription>Create, edit, and manage exams for your courses.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-1" onClick={() => openExamDialog(null)}>
                        <PlusCircle className="h-3.5 w-3.5" />
                        New Exam
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Loading exams...</p> : exams.length === 0 ? <p>No exams found.</p> : (
                        <div className="space-y-4">
                            {exams.map(exam => (
                                <Collapsible key={exam.id} className="border rounded-lg">
                                    <div className="flex justify-between items-center w-full p-4">
                                        <CollapsibleTrigger asChild>
                                           <div className="flex-1 text-left cursor-pointer">
                                                <p className="font-semibold">{exam.name}</p>
                                                <p className="text-sm text-muted-foreground">{courses.find(c => c.id === exam.courseId)?.name}</p>
                                           </div>
                                        </CollapsibleTrigger>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openExamDialog(exam)}><Edit className="h-4 w-4"/></Button>
                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteExam(exam.id)}><Trash2 className="h-4 w-4"/></Button>
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <ChevronDown className="h-5 w-5" />
                                                </Button>
                                            </CollapsibleTrigger>
                                        </div>
                                    </div>
                                    <CollapsibleContent className="p-4 pt-0">
                                        <QuestionManager exam={exam} />
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isExamDialogOpen} onOpenChange={setIsExamDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingExam ? 'Edit Exam' : 'Create New Exam'}</DialogTitle>
                        <DialogDescription>{editingExam ? `Update details for ${editingExam.name}.` : 'Fill out the form to create a new exam.'}</DialogDescription>
                    </DialogHeader>
                    <Form {...examForm}>
                        <form onSubmit={examForm.handleSubmit(handleExamSubmit)} className="space-y-4">
                            <div className="max-h-[60vh] overflow-y-auto space-y-4 p-1">
                             <FormField control={examForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Exam Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                             <FormField control={examForm.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
                             <FormField control={examForm.control} name="courseId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Course</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a course"/></SelectTrigger></FormControl>
                                        <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={examForm.control} name="startTime" render={({ field }) => <FormItem><FormLabel>Start Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>} />
                                <FormField control={examForm.control} name="endTime" render={({ field }) => <FormItem><FormLabel>End Time</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>} />
                            </div>
                            <FormField control={examForm.control} name="duration" render={({ field }) => <FormItem><FormLabel>Duration (minutes)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
                             <FormField control={examForm.control} name="multipleAttempts" render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Allow Multiple Attempts</FormLabel>
                                    </div>
                                </FormItem>
                            )} />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Exam'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function QuestionManager({ exam }: { exam: Exam }) {
    const { toast } = useToast();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

    useEffect(() => {
        const questionsRef = ref(db, `exams/${exam.id}/questions`);
        const unsubscribe = onValue(questionsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setQuestions(Object.entries(data).map(([id, value]) => ({ id, ...(value as Omit<Question, 'id'>) })));
            } else {
                setQuestions([]);
            }
        });
        return () => unsubscribe();
    }, [exam.id]);
    
    const openQuestionModal = (question: Question | null) => {
        setEditingQuestion(question);
        setIsQuestionModalOpen(true);
    };

    const handleDeleteQuestion = (questionId: string) => {
        if(window.confirm('Are you sure you want to delete this question?')) {
            remove(ref(db, `exams/${exam.id}/questions/${questionId}`))
            .then(() => toast({ title: 'Success', description: 'Question deleted.' }))
            .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h4 className="font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5"/>Questions ({questions.length})</h4>
                <Button variant="outline" size="sm" onClick={() => openQuestionModal(null)}><PlusCircle className="mr-2 h-4 w-4"/>Add Question</Button>
            </div>
             {questions.length > 0 ? (
                <div className="space-y-2">
                    {questions.map((q, index) => (
                         <div key={q.id} className="border p-3 rounded-md bg-background">
                            <div className="flex justify-between items-start">
                                <p className="font-medium">{index + 1}. {q.text} <span className="text-muted-foreground text-sm">({q.marks} marks)</span></p>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openQuestionModal(q)}><Edit className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground capitalize pl-4">{q.type.replace('-', ' ')}</p>
                            {q.type === 'multiple-choice' && (
                                <div className="pl-4 mt-1 space-y-1">
                                    {q.options?.map((opt, i) => (
                                        <p key={i} className={`text-sm ${opt === q.correctAnswer ? 'text-green-600 font-semibold' : ''}`}>{opt}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : <p className="text-muted-foreground text-center py-4">No questions added yet.</p>}
            <QuestionModal 
                isOpen={isQuestionModalOpen} 
                setIsOpen={setIsQuestionModalOpen} 
                examId={exam.id} 
                question={editingQuestion}
            />
        </div>
    );
}


function QuestionModal({ isOpen, setIsOpen, examId, question }: { isOpen: boolean, setIsOpen: (open: boolean) => void, examId: string, question: Question | null }) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<z.infer<typeof questionSchema>>({
        resolver: zodResolver(questionSchema),
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control as any,
        name: 'options' as any,
    });

    const type = form.watch('type');

    useEffect(() => {
        if (question) {
            form.reset({
                ...question,
                options: question.options || [],
            });
        } else {
             form.reset({
                text: '',
                type: 'multiple-choice',
                marks: 1,
                options: ['',''],
                correctAnswer: ''
            });
        }
    }, [question, isOpen, form]);


    useEffect(() => {
        if (form.formState.isDirty) return; // Don't override if user has made changes
        const defaultMarks = {
            'multiple-choice': 1,
            'short-answer': 2,
            'long-answer': 5
        };
        form.setValue('marks', defaultMarks[type]);
    }, [type, form]);
    
    const handleQuestionSubmit = (values: any) => {
        setIsSubmitting(true);

        const questionData = { ...values };

        if (question) { // Editing existing question
            update(ref(db, `exams/${examId}/questions/${question.id}`), questionData)
            .then(() => {
                toast({ title: 'Success', description: 'Question updated.' });
                setIsOpen(false);
            })
            .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
            .finally(() => setIsSubmitting(false));
        } else { // Adding new question
            const newQuestionRef = push(ref(db, `exams/${examId}/questions`));
            set(newQuestionRef, { ...questionData, id: newQuestionRef.key })
            .then(() => {
                toast({ title: 'Success', description: 'Question added.' });
                setIsOpen(false);
            })
            .catch(err => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
            .finally(() => setIsSubmitting(false));
        }
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{question ? 'Edit Question' : 'Add New Question'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleQuestionSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                        <FormField control={form.control} name="text" render={({ field }) => (
                            <FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage /></FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Question Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                            <SelectItem value="short-answer">Short Answer</SelectItem>
                                            <SelectItem value="long-answer">Long Answer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}/>
                            <FormField control={form.control} name="marks" render={({ field }) => (
                                <FormItem><FormLabel>Marks</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        
                        {type === 'multiple-choice' && (
                             <div className="space-y-3 rounded-md border p-4">
                                <FormField
                                    control={form.control}
                                    name="correctAnswer"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                        <FormLabel>Options (select the correct one)</FormLabel>
                                        <FormControl>
                                            <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex flex-col space-y-1"
                                            >
                                            {fields.map((option, index) => (
                                                <FormItem key={option.id} className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value={form.watch(`options.${index}`)} />
                                                    </FormControl>
                                                     <Input {...form.register(`options.${index}`)} placeholder={`Option ${index + 1}`}/>
                                                     <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}><Trash2 className="h-4 w-4"/></Button>
                                                </FormItem>
                                            ))}
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={() => append("")}>Add Option</Button>
                            </div>
                        )}

                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save Question'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

    