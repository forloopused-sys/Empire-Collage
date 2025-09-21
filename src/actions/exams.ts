// Minimal client-side helper for submitting exam results.
import { ref, push, set } from 'firebase/database';
import { db } from '@/lib/firebase';

export async function submitExam(resultData: any) {
	const resultsRef = ref(db, 'results');
	const newRef = push(resultsRef);
	const data = { id: newRef.key, ...resultData };
	await set(newRef, data);
	return data;
}

export default submitExam;
