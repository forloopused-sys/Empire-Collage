
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ref, onValue, get, set, push } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth-provider';
import { Exam, Question, Answer } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { Proctoring } from '@/components/dashboard/Proctoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Loader2, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { submitExam } from '@/actions/exams';

export default function ExamTakingPage() {
    const { examId } = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { user, userProfile } = useAuth();
    const [exam, setExam] = useState<Exam | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    const form = useForm();

    useEffect(() => {
        if (!examId) return;
        const examRef = ref(db, `exams/${examId}`);
        const unsubscribe = onValue(examRef, (snapshot) => {
            if (snapshot.exists()) {
                const examData = snapshot.val();
                setExam({ id: examId as string, ...examData });
                setTimeLeft(examData.duration * 60);
            } else {
                setExam(null);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [examId]);

    useEffect(() => {
        if (timeLeft === 0) {
            form.handleSubmit(onSubmit)();
        }

        if (!timeLeft) return;

        const intervalId = setInterval(() => {
            setTimeLeft(timeLeft - 1);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [timeLeft, form]);


    const onSubmit = async (values: any) => {
        if (!user || !userProfile || !exam) {
            toast({ title: "Error", description: "Authentication error.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        
        // This is a temporary solution for client-side submission
        try {
            const resultsRef = ref(db, `results`);
            const newResultRef = push(resultsRef); // Generate a unique ID
            
            const examSnapshot = await get(ref(db, `exams/${exam.id}`));
            if(!examSnapshot.exists()) {
                 throw new Error("Exam data not found.");
            }
            const examData: Exam = examSnapshot.val();
            
            let totalMarks = 0;
            const processedAnswers: Record<string, Answer> = {};
            
            Object.entries(values).forEach(([questionId, studentAnswer]) => {
                const question = Array.isArray(examData.questions)
                    ? (examData.questions as any[]).find(q => q.id === questionId)
                    : examData.questions?.[questionId];
                if(question) {
                    let marksAwarded = 0;
                    let answerStatus: "auto-graded" | "pending-evaluation" = "auto-graded";

                    if(question.type === 'multiple-choice') {
                        if(question.correctAnswer === studentAnswer) {
                            marksAwarded = question.marks;
                            totalMarks += question.marks;
                        }
                    } else {
                        // Marks for short/long answers are awarded manually later
                        marksAwarded = 0;
                        answerStatus = "pending-evaluation";
                    }
                    processedAnswers[questionId] = { 
                        answer: studentAnswer as string, 
                        marks: marksAwarded,
                        status: answerStatus
                    };
                }
            });

            const resultData = {
                id: newResultRef.key,
                examId: exam.id,
                studentId: user.uid,
                courseId: userProfile.courseId!,
                answers: processedAnswers,
                totalMarks: totalMarks,
                isPublished: false,
            };
            
            await set(newResultRef, resultData);

            toast({ title: "Success", description: "Your exam has been submitted." });
            router.push('/dashboard/student');
            
        } catch (error: any) {
            console.error("Client-side submission error:", error);
            toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
            setIsSubmitting(false);
        }
    };
    
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!exam) {
        return <div className="text-center py-10">Exam not found or you do not have permission.</div>;
    }

        const questions: Question[] = exam.questions
            ? Array.isArray(exam.questions)
                ? exam.questions
                : Object.entries(exam.questions).map(([id, q]) => ({ id, ...(q as any) }))
            : [];

    return (
        <Proctoring>
            <div className="max-w-4xl mx-auto p-4">
                <Card className="sticky top-4 z-10">
                    <CardHeader>
                        <CardTitle>{exam.name}</CardTitle>
                        <CardDescription>{exam.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-between items-center">
                        <p className="font-semibold">Questions: {questions.length}</p>
                        <div className="flex items-center gap-2 font-bold text-lg text-destructive">
                           <Timer className="h-6 w-6"/>
                           <span>{timeLeft !== null ? formatTime(timeLeft) : 'Loading...'}</span>
                        </div>
                    </CardFooter>
                </Card>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
                        {questions.map((q, index) => (
                            <Card key={q.id}>
                                <CardHeader>
                                    <CardTitle className="text-lg">Question {index + 1} <span className="text-sm font-normal text-muted-foreground">({q.marks} marks)</span></CardTitle>
                                    <CardDescription className="text-base text-foreground pt-2">{q.text}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FormField
                                        control={form.control}
                                        name={q.id}
                                        rules={{ required: "This question is required."}}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    {q.type === 'multiple-choice' && q.options ? (
                                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                                                            {q.options.map((opt, i) => (
                                                                <FormItem key={i} className="flex items-center space-x-3">
                                                                    <FormControl>
                                                                        <RadioGroupItem value={opt} id={`${q.id}-opt-${i}`} />
                                                                    </FormControl>
                                                                    <Label htmlFor={`${q.id}-opt-${i}`} className="font-normal">{opt}</Label>
                                                                </FormItem>
                                                            ))}
                                                        </RadioGroup>
                                                    ) : (
                                                        <Textarea placeholder="Your answer..." {...field} />
                                                    )}
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        ))}
                         <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting...</> : 'Submit Exam'}
                        </Button>
                    </form>
                </Form>
            </div>
        </Proctoring>
    );
}
