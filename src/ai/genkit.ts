// Minimal direct Google Generative API client (no genkit dependency)
// Exports a named `ai` object with `generate(prompt)` and `defineFlow`.

const GOOGLE_KEY = process.env.GOOGLEAI_API_KEY;
const DEFAULT_MODEL = process.env.GOOGLEAI_MODEL || '';
let selectedModel: string | null = null;

// Candidate models to try (order is important: prefer lighter commonly-available models)
const CANDIDATE_MODELS = [
  process.env.GOOGLEAI_MODEL || '',
  'text-bison-001',
  'text-bison-001@001',
  'gemini-mini',
  'gemini-preview',
  'gpt-4o-mini',
].filter(Boolean) as string[];

function makeStub(msg: string) {
  return {
    async generate() {
      return msg;
    },
    defineFlow() {
      return async () => msg;
    },
  };
}

if (!GOOGLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[ai] GOOGLEAI_API_KEY not set — AI disabled');
}

async function googleGenerate(prompt: string) {
  if (!GOOGLE_KEY) return `Google AI key not configured. Set GOOGLEAI_API_KEY.`;
  // choose a model: use selectedModel if discovered, otherwise probe candidates
  const model = selectedModel || DEFAULT_MODEL;
  if (!model) {
    // probe candidates to find one that responds
    for (const candidate of CANDIDATE_MODELS) {
      const urlProbe = `https://generativelanguage.googleapis.com/v1beta2/models/${candidate}:generateText?key=${GOOGLE_KEY}`;
      try {
        const probe = await fetch(urlProbe, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GOOGLE_KEY },
          body: JSON.stringify({ prompt: { text: 'ping' }, maxOutputTokens: 1 }),
        });
        if (probe.ok) {
          selectedModel = candidate;
          break;
        }
      } catch (e) {
        // ignore probe errors and try next candidate
      }
    }
    if (!selectedModel) {
      // no models worked — return helpful message
      return `No available AI model found for this API key. Try setting GOOGLEAI_MODEL to a model your account supports (e.g. 'text-bison-001').`;
    }
  }

  const modelToUse = selectedModel as string;
  // Append API key as query param and include x-goog-api-key header for API-key auth
  const url = `https://generativelanguage.googleapis.com/v1beta2/models/${modelToUse}:generateText?key=${GOOGLE_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GOOGLE_KEY,
      },
      body: JSON.stringify({
        prompt: { text: prompt },
        temperature: 0.2,
        maxOutputTokens: 512,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 404) {
        // model became unavailable; try to clear selectedModel and return helpful message
        selectedModel = null;
        // eslint-disable-next-line no-console
        console.warn(`[ai] model not found: ${modelToUse} (status ${res.status}) - ${text}`);
        return `AI model '${modelToUse}' not found or not available for this API key. Try setting GOOGLEAI_MODEL to a supported model such as 'text-bison-001'.`;
      }
      // other non-ok statuses
      // eslint-disable-next-line no-console
      console.warn(`[ai] Google Generative API returned status ${res.status}: ${text}`);
      return `AI service returned an error (status ${res.status}). Check your API key, model, and network connectivity.`;
    }

    const json = await res.json().catch(() => ({}));
    // Friendly extraction for common response shapes
    const output = json?.candidates?.[0]?.output || json?.candidates?.[0]?.content?.[0]?.text || json?.output?.[0]?.content?.[0]?.text;
    return output || JSON.stringify(json || {});
  } catch (err: any) {
    // network/other errors — return a helpful message rather than throwing
    // eslint-disable-next-line no-console
    console.warn('[ai] googleGenerate network/error:', err?.message || String(err));
    return `AI service currently unavailable due to network or provider errors. Check your GOOGLEAI_API_KEY, network connection, and provider status.`;
  }
}

export const ai = GOOGLE_KEY
  ? {
      async generate(prompt: string) {
        return await googleGenerate(prompt);
      },
      defineFlow(_: any, __?: any) {
        return async ({ message, history }: any) => {
          const prompt = typeof message === 'string' ? message : JSON.stringify({ message, history });
          return await googleGenerate(prompt);
        };
      },
    }
  : makeStub('GoogleAI not configured. Set GOOGLEAI_API_KEY to enable AI features.');

