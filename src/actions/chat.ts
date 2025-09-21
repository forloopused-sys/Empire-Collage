
"use server";

import { run } from "@/ai/flows/chat";

export async function runChat(history: any[], message: string) {
    return await run(history, message);
}
