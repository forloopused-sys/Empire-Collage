

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'admin' | 'sub-admin' | string;
  admissionNo?: string;
  courseId?: string;
  assignedCourses?: string[];
}

export interface Course {
  id: string;
  name:string;
  subjects?: string[];
}

export interface AttendanceRecord {
  [date: string]: {
    [studentId: string]: 'present' | 'absent' | 'half-day';
  };
}

export interface LeaveRequest {
    id: string;
    studentId: string;
    studentName: string;
    studentAdmissionNo: string;
    courseId: string;
    date: string; // YYYY-MM-DD
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface Notification {
  id: string;
  message: string;
  imageUrl?: string;
  videoUrl?: string;
  timestamp: number;
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'teacher' | 'student' | string;
  recipientRole: 'all' | 'students' | 'teachers' | 'admin' | string;
  recipientCourseId?: string;
  readBy?: { [userId: string]: boolean };
}

export interface Question {
  id: string;
  text: string;
  type: 'multiple-choice' | 'short-answer' | 'long-answer';
  options?: string[];
  correctAnswer?: string;
  marks: number;
}
  
export interface Exam {
  id: string;
  name: string;
  description: string;
  courseId: string;
  startTime: string; // ISO 8601 format
  endTime: string;   // ISO 8601 format
  duration: number; // in minutes
  multipleAttempts: boolean;
  questions: Record<string, Question> | Question[];
}

export interface Answer {
    answer: string;
    marks: number;
    status: 'auto-graded' | 'pending-evaluation' | 'evaluated';
}

export interface Result {
    id: string;
    examId: string;
    studentId: string;
    courseId: string;
    studentName?: string;
    examName?: string;
    answers: Record<string, Answer>;
    totalMarks?: number;
    isPublished: boolean;
    publishDate?: string; // ISO 8601 format
}

export interface Subject {
    id: string;
    name: string;
}

export interface AttendanceSettings {
    absentPenalty: number;
    halfDayPenalty: number;
    examEligibilityThreshold: number;
}
