
"use client";

import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, update, get, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth-provider';
import { Course, Exam, Result, UserProfile, Question } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Award, Loader2, Calendar as CalendarIcon, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function ResultsPage() {
    const { toast } = useToast();
    const { userProfile } = useAuth();
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [allExams, setAllExams] = useState<Exam[]>([]);
    const [results, setResults] = useState<Result[]>([]);
    const [users, setUsers] = useState<Record<string, UserProfile>>({});
    
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedExamId, setSelectedExamId] = useState('');
    const [publishDate, setPublishDate] = useState<Date | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedResult, setSelectedResult] = useState<Result | null>(null);

    const isTeacher = userProfile?.role === 'teacher';
    const isAdmin = userProfile?.role === 'admin';

    useEffect(() => {
        const coursesRef = ref(db, 'courses');
        const unsubscribeCourses = onValue(coursesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const coursesList = Object.entries(data).map(([id, value]) => ({ id, ...(value as any) }));
                if (isTeacher) {
                    const teacherCourses = coursesList.filter(c => userProfile.assignedCourses?.includes(c.id));
                    setAllCourses(teacherCourses);
                    if (teacherCourses.length > 0) {
                        setSelectedCourseId(teacherCourses[0].id);
                    }
                } else {
                    setAllCourses(coursesList);
                }
            }
        });

        const examsRef = ref(db, 'exams');
        const unsubscribeExams = onValue(examsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) setAllExams(Object.entries(data).map(([id, value]) => ({ id, ...(value as any) })));
        });

        const usersRef = ref(db, 'users');
        const unsubscribeUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) setUsers(snapshot.val());
        });

        return () => {
            unsubscribeCourses();
            unsubscribeExams();
            unsubscribeUsers();
        };
    }, [userProfile, isTeacher]);

    useEffect(() => {
        if (!selectedExamId) {
            setResults([]);
            return;
        }
        setIsLoading(true);
        const resultsRef = ref(db, 'results');
        const unsubscribeResults = onValue(resultsRef, (snapshot) => {
            if (snapshot.exists()) {
                const allResultsData: Record<string, Result> = snapshot.val();
                const examResults = Object.entries(allResultsData)
                    .filter(([, r]) => r.examId === selectedExamId)
                    .map(([id, r]) => ({
                        ...r,
                        id,
                        studentName: users[r.studentId]?.name || 'Unknown Student',
                    }));
                setResults(examResults);
            } else {
                setResults([]);
            }
            setIsLoading(false);
        });

        return () => unsubscribeResults();
    }, [selectedExamId, users]);

    const filteredExams = useMemo(() => {
        return allExams.filter(exam => exam.courseId === selectedCourseId);
    }, [selectedCourseId, allExams]);
    
    const handlePublish = async (isPublished: boolean) => {
        if (!selectedExamId || !selectedCourseId) {
            toast({ title: 'Error', description: 'Please select a course and an exam.', variant: 'destructive' });
            return;
        }
        setIsSubmitting(true);
        try {
            const updates: Record<string, any> = {};
            results.forEach(result => {
                updates[`/results/${result.id}/isPublished`] = isPublished;
                 if(isPublished && publishDate) {
                     updates[`/results/${result.id}/publishDate`] = publishDate.toISOString();
                } else if (!isPublished) {
                     updates[`/results/${result.id}/publishDate`] = null;
                }
            });
            
            await update(ref(db), updates);
            toast({ title: 'Success', description: `Results have been ${isPublished ? 'published' : 'unpublished'}.` });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteResult = async (resultId: string) => {
        if (window.confirm('Are you sure you want to delete this result? This will allow the student to re-attempt the exam.')) {
            try {
                await remove(ref(db, `results/${resultId}`));
                toast({ title: 'Success', description: 'Result deleted successfully.' });
            } catch (error: any) {
                toast({ title: 'Error', description: 'Failed to delete result.', variant: 'destructive' });
            }
        }
    };
    
    const currentExam = allExams.find(e => e.id === selectedExamId);
    const examResultsInfo = results[0]; // Get scheduling info from the first result

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Award /> Manage Exam Results</CardTitle>
                    <CardDescription>Publish, grade, and review exam results.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="grid gap-2 flex-1">
                            <label>Course</label>
                            <Select value={selectedCourseId} onValueChange={v => {setSelectedCourseId(v); setSelectedExamId('');}}>
                                <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                                <SelectContent>{allCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2 flex-1">
                            <label>Exam</label>
                            <Select value={selectedExamId} onValueChange={setSelectedExamId} disabled={!selectedCourseId}>
                                <SelectTrigger><SelectValue placeholder="Select Exam" /></SelectTrigger>
                                <SelectContent>{filteredExams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                     {selectedExamId && isAdmin && (
                        <Card className="bg-muted/50">
                            <CardHeader>
                                <CardTitle className="text-lg">Publishing Options</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="grid gap-2">
                                     <label>Schedule Publish Date (Optional)</label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !publishDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {publishDate ? format(publishDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={publishDate} onSelect={setPublishDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="flex gap-2">
                                    <Button onClick={() => handlePublish(true)} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                        {publishDate ? 'Schedule Publish' : 'Publish Now'}
                                    </Button>
                                     <Button variant="destructive" onClick={() => handlePublish(false)} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                        Unpublish
                                    </Button>
                                </div>
                            </CardContent>
                             {examResultsInfo && (
                                <CardFooter>
                                    <div className="text-sm text-muted-foreground">
                                        Current Status: {examResultsInfo.isPublished ? 
                                        <Badge>Published {examResultsInfo.publishDate ? `(scheduled for ${format(new Date(examResultsInfo.publishDate), 'PPP')})` : ''}</Badge> 
                                        : <Badge variant="secondary">Not Published</Badge>}
                                    </div>
                                </CardFooter>
                            )}
                        </Card>
                     )}
                </CardContent>
            </Card>

            {selectedExamId && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Results for {currentExam?.name}</CardTitle>
                        <CardDescription>Viewing and grading results for the selected exam.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <p>Loading results...</p> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead>Total Marks</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.length > 0 ? results.map(result => (
                                        <TableRow key={result.id}>
                                            <TableCell>{result.studentName}</TableCell>
                                            <TableCell>{result.totalMarks ?? 'Not Graded'}</TableCell>
                                            <TableCell>
                                                <Badge variant={result.isPublished ? 'default' : 'secondary'}>
                                                    {result.isPublished ? 'Published' : 'Not Published'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => setSelectedResult(result)}>
                                                    <Edit className="mr-2 h-4 w-4"/> Grade
                                                </Button>
                                                <Button variant="destructive" size="sm" className="ml-2" onClick={() => handleDeleteResult(result.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={4} className="text-center">No results found for this exam yet.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                 </Card>
            )}

            {selectedResult && currentExam && (
                <GradingModal 
                    result={selectedResult} 
                    exam={currentExam} 
                    isOpen={!!selectedResult} 
                    setIsOpen={() => setSelectedResult(null)} 
                />
            )}
        </div>
    );
}

function GradingModal({ result, exam, isOpen, setIsOpen }: { result: Result, exam: Exam, isOpen: boolean, setIsOpen: () => void }) {
    const { toast } = useToast();
    const [marks, setMarks] = useState<Record<string, number>>({});
    const [totalMarks, setTotalMarks] = useState(result.totalMarks || 0);

    useEffect(() => {
        if (!isOpen) return;
        
        const initialMarks: Record<string, number> = {};
        let newTotal = 0;
        if (result.answers) {
            Object.entries(result.answers).forEach(([questionId, answerData]) => {
                const markValue = answerData.marks ?? 0;
                initialMarks[questionId] = markValue;
                newTotal += markValue;
            });
        }
        setMarks(initialMarks);
        setTotalMarks(newTotal);
    }, [result, isOpen]);

    const handleMarkChange = (questionId: string, value: string, maxMarks: number) => {
        const newMark = Math.max(0, Math.min(parseInt(value) || 0, maxMarks));
        const updatedMarks = { ...marks, [questionId]: newMark };
        setMarks(updatedMarks);

        // Recalculate total
        let newTotal = 0;
        Object.values(updatedMarks).forEach(m => newTotal += m || 0);
        setTotalMarks(newTotal);
    };

    const handleSaveMarks = async () => {
        try {
            const updates: Record<string, any> = {};
            Object.entries(marks).forEach(([questionId, mark]) => {
                updates[`/results/${result.id}/answers/${questionId}/marks`] = mark;
             // Normalize questions to be indexable by id
             const questionsById: Record<string, any> = Array.isArray(exam.questions)
                ? (exam.questions as any[]).reduce((acc, q) => ({ ...acc, [q.id]: q }), {})
                : (exam.questions as Record<string, any> || {});

             if (questionsById[questionId]?.type !== 'multiple-choice') {
                 updates[`/results/${result.id}/answers/${questionId}/status`] = 'evaluated';
             }
            });
            updates[`/results/${result.id}/totalMarks`] = totalMarks;
            
            await update(ref(db), updates);
            toast({ title: 'Success', description: 'Marks saved successfully.' });
            setIsOpen();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save marks.', variant: 'destructive' });
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Grade Exam for: {result.studentName}</DialogTitle>
                    <DialogDescription>
                        Exam: {exam.name} | Total Marks: <Badge>{totalMarks}</Badge>
                    </DialogDescription>
                    <DialogClose />
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                   {result.answers && Object.entries(result.answers).map(([questionId, answerData]) => {
                                             const question = Array.isArray(exam.questions)
                                                 ? (exam.questions as any[]).find(q => q.id === questionId)
                                                 : exam.questions?.[questionId];
                       if (!question) return null;
                       
                       return (
                           <Card key={questionId}>
                               <CardHeader>
                                   <CardTitle className="text-md">{question.text}</CardTitle>
                                   <CardDescription>Max Marks: {question.marks}</CardDescription>
                               </CardHeader>
                               <CardContent>
                                   <p className="font-semibold">Student's Answer:</p>
                                   <p className="p-2 bg-muted rounded-md">{answerData.answer}</p>
                                   {question.type === 'multiple-choice' && (
                                       <p className="text-sm mt-2">Correct Answer: <span className="font-bold text-primary">{question.correctAnswer}</span></p>
                                   )}
                               </CardContent>
                               <CardFooter>
                                    <div className="flex items-center gap-2">
                                       <Label htmlFor={`marks-${questionId}`}>Marks Awarded:</Label>
                                        <Input
                                            id={`marks-${questionId}`}
                                            type="number"
                                            value={marks[questionId] ?? ''}
                                            onChange={(e) => handleMarkChange(questionId, e.target.value, question.marks)}
                                            className="w-24"
                                            readOnly={false}
                                        />
                                   </div>
                               </CardFooter>
                           </Card>
                       )
                   })}
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                       <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSaveMarks}>Save Marks</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    