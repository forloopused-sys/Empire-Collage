
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const chatHistorySchema = z.array(
  z.object({
    role: z.enum(['user', 'model']),
    content: z.array(
      z.object({
        text: z.string(),
      })
    ),
  })
);

export const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: z.object({
      history: chatHistorySchema,
      message: z.string(),
    }),
    outputSchema: z.string(),
  },
  async ({ history, message }: { history: Array<{ role: 'user' | 'model'; content: Array<{ text: string }> }>; message: string }) => {
    // genkit.generate expects a prompt string in this project setup.
    const combinedHistory = history
      .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content.map((c: any) => c.text).join('\n')}`)
      .join('\n');

    const systemPrompt = 'You are a helpful and friendly AI assistant for students. Your name is Sparky. Be encouraging and provide clear explanations.';
    const prompt = `${systemPrompt}\n\nConversation:\n${combinedHistory}\nUser: ${message}\nAssistant:`;

    try {
      const response = await ai.generate(prompt);
      // response may be a string or object depending on genkit version
      return typeof response === 'string' ? response : (response as any).text || '';
    } catch (err: any) {
      // Handle genkit model-not-found errors gracefully in dev environments.
      const message = err?.message || err?.originalMessage || String(err);
      if (err?.status === 'NOT_FOUND' || /model.*not found/i.test(message)) {
        console.warn('[chatFlow] Genkit model not found:', message);
        return `AI model not available. To enable AI features set a supported model and provider credentials (e.g. GENKIT_MODEL, GENKIT_PROVIDER, GENKIT_API_KEY or GOOGLEAI_API_KEY).`;
      }
      // Network errors or connection resets
      if (err?.code === 'ECONNRESET' || /network error/i.test(message) || /fetch/i.test(message)) {
        console.warn('[chatFlow] Network error contacting AI provider:', message);
        return `AI service currently unavailable due to network or provider errors. Check your API key, network connection, and provider status.`;
      }
      throw err;
    }
  }
);

export async function run(history: Array<{ role: 'user' | 'model'; content: Array<{ text: string }> }>, message: string) {
  const validatedHistory = chatHistorySchema.parse(history);
  return await chatFlow({ history: validatedHistory, message });
}
