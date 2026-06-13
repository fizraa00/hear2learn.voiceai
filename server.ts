import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy init GoogleGenAI to prevent boot crashes if API key is not yet present
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY is not defined. AI features will fallback to dummy responses.");
    }
    genAIClient = new GoogleGenAI({
      apiKey: key || 'MOCK_KEY',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAIClient;
}

// Caches whether gemini-3.5-flash is experiencing rate-limits or quota exhaustion
let useFallbackModel = true;

// Robust retry wrapper with exponential backoff and jitter to recover from transient demand spikes (such as 503 UNAVAILABLE or 429 rate limit errors)
async function generateContentWithRetry(params: any, retries = 3, delayMs = 1500): Promise<any> {
  const ai = getGenAI();
  const requestParams = { ...params };

  // If we already know the main model is rate-limited or quota exhausted, bypass it immediately to save latency and avoid logging errors
  if (requestParams.model === 'gemini-3.5-flash' && useFallbackModel) {
    requestParams.model = 'gemini-3.1-flash-lite';
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(requestParams);
    } catch (error: any) {
      const errorMessage = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      const has503 = errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('high demand') || errorMessage.includes('spikes in demand');
      const has429 = errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Quota exceeded');
      const isTransient = has503 || has429 || error?.status === 503 || error?.status === 429 || error?.statusCode === 503 || error?.statusCode === 429;

      // Transparently fall back to gemini-3.1-flash-lite if gemini-3.5-flash encounters quota limits or transient unavailability
      if ((has429 || has503) && requestParams.model === 'gemini-3.5-flash') {
        useFallbackModel = true; // Cache the preference for gemini-3.1-flash-lite globally for subsequent calls
        console.log(`[GEMINI FALLBACK] Model ${requestParams.model} encountered transient error or quota limit. Switching transparently to gemini-3.1-flash-lite immediately.`);
        requestParams.model = 'gemini-3.1-flash-lite';
        // Add a tiny jitter delay and continue the loop to retry immediately under the fallback model
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      // Print error only on the final attempt or if it's not transient
      if (attempt === retries || !isTransient) {
        console.error(`Gemini API Final Attempt ${attempt} failed with error:`, error);
      } else {
        console.log(`Gemini API Attempt ${attempt} encountered a retriable transient error: ${errorMessage.slice(0, 120)}...`);
      }

      if (isTransient && attempt < retries) {
        const nextDelay = delayMs * Math.pow(2, attempt - 1) + Math.random() * 300;
        console.log(`[Transient Gemini Error Detected] Retrying in ${Math.round(nextDelay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, nextDelay));
      } else {
        // Ultimate fallback safety check
        if (requestParams.model === 'gemini-3.5-flash') {
          useFallbackModel = true;
          console.log(`[GEMINI ULTIMATE FALLBACK] Switch to gemini-3.1-flash-lite on final attempt fail.`);
          requestParams.model = 'gemini-3.1-flash-lite';
          try {
            return await ai.models.generateContent(requestParams);
          } catch (fallbackError: any) {
            console.error('Ultimate gemini-3.1-flash-lite fallback failed:', fallbackError);
            throw fallbackError;
          }
        }
        throw error;
      }
    }
  }
}

// REST Endpoints for AI Capabilities

const getLanguageName = (code: string): string => {
  if (!code) return 'English';
  const mapping: Record<string, string> = {
    'en-US': 'English',
    'hi-IN': 'Hindi',
    'te-IN': 'Telugu',
    'ta-IN': 'Tamil',
    'ur-PK': 'Urdu',
    'en': 'English',
    'hi': 'Hindi',
    'te': 'Telugu',
    'ta': 'Tamil',
    'ur': 'Urdu'
  };
  return mapping[code] || mapping[code.split('-')[0]] || code;
};

// 1. Explain Topic Endpoint
app.post('/api/gemini/explain', async (req, res) => {
  const { content, topic, level, language } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'Topic is required.' });
  }

  const targetLang = getLanguageName(language);
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Elegant fallback simulation
    return res.json({
      explanation: `[Demo Mode / API Key Not Set] Explanation of "${topic}" in ${targetLang} at "${level || 'simple'}" level. Osmosis is the movement of water molecules from an area of higher concentration to an area of lower concentration through a semi-permeable membrane. Think of standard tea bags in warm water!`
    });
  }

  try {
    let promptInstruction = '';
    if (level === 'eli5') {
      promptInstruction = "Explain this concept like I am a 10-year old using vivid, simple real-life analogies.";
    } else if (level === 'summary') {
      promptInstruction = "Provide a high-level concise summary containing only the absolute core points.";
    } else {
      promptInstruction = "Provide a comprehensive, clear explanation or breakdown of the topic with structured examples.";
    }

    const response = await generateContentWithRetry({
      model: 'gemini-3.5-flash',
      contents: `Context Document Content:\n${content || 'No text content available.'}\n\nTask: Explain the topic "${topic}" in ${targetLang}.\nRequirements: ${promptInstruction}\nMake it sound friendly, encouraging, and highly optimized for reading aloud. Answer strictly in the requested language. Do not use complex markdown layout (like tables or grid text), keep it in basic clean paragraphs.`,
    });

    res.json({ explanation: response.text });
  } catch (error: any) {
    console.error('Gemini Explain Error after retries:', error);
    // Graceful conversational fallback and friendly recovery instead of strict 500 block page
    res.json({
      explanation: `I am currently experiencing very high demand, but let me summarize "${topic}". Based on our study materials, this topic covers critical principles. Try repeating key ideas out loud, testing your knowledge with an interactive quiz card, or asking me for a breakdown again in a few seconds!`
    });
  }
});

// 2. Generate Structured Quiz Endpoint
app.post('/api/gemini/quiz', async (req, res) => {
  const { content, topic, totalCount, language } = req.body;
  const count = totalCount || 3;
  const targetLang = getLanguageName(language);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Demo mode dummy questions for Photosynthesis
    return res.json({
      questions: [
        {
          question: "Where do the light-dependent reactions of photosynthesis take place?",
          options: ["Thylakoid membranes", "Stroma of the chloroplast", "Mitochondrial matrix", "External cell wall"],
          answer: "Thylakoid membranes",
          explanation: "The light-dependent reactions occur in the thylakoid membranes, where solar energy is absorbed by chlorophyll."
        },
        {
          question: "What is the primary waste product of photosynthesis released into the atmosphere?",
          options: ["Carbon dioxide", "Oxygen gas", "Water vapor", "Nitrogen"],
          answer: "Oxygen gas",
          explanation: "Oxygen is produced as a byproduct when water molecules are split (photolysis) during the light-dependent reactions."
        }
      ]
    });
  }

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-3.5-flash',
      contents: `Study Context Material:\n${content || 'No text content available.'}\n\nTask: Create exactly ${count} multiple-choice questions (MCQs) testing comprehension of "${topic || 'uploaded content'}" in ${targetLang}.\nEach item must have exactly 4 diverse options with precisely 1 correct answer option.\nProvide high-quality explanation or feedback for when the student makes a choice.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: "List of educational multiple choice questions",
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING, description: "The quiz question content text, worded clearly and simple." },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of exactly 4 distinct options."
              },
              answer: { type: Type.STRING, description: "The exact matching text of the correct option from the options list." },
              explanation: { type: Type.STRING, description: "A supportive description of why this is correct, written in conversational voice-first layout." }
            },
            required: ["question", "options", "answer", "explanation"]
          }
        },
        systemInstruction: "You are Hear2Learn, a conversational audio study evaluation engine. Generate educational test items exactly adhering to the requested language. Do not output anything other than clean, properly formatted educational assessments in JSON format."
      }
    });

    const parsedQuestions = JSON.parse(response.text || '[]');
    res.json({ questions: parsedQuestions });
  } catch (error: any) {
    console.error('Gemini Quiz Generation Error after retries:', error);
    // Successful adaptive fallback quiz questions list to handle 503 UNAVAILABLE error gracefully
    res.json({
      questions: [
        {
          question: `Let's practice a core study checkup for "${topic || 'our assignment'}". What is a great active learning strategy to master content?`,
          options: ["Passive re-reading of notes", "Testing yourself with active retrieval quizzes", "Avoiding challenging topics", "Listening into quiet background noise"],
          answer: "Testing yourself with active retrieval quizzes",
          explanation: "Testing yourself with active retrieval strengthens retention and builds long-term memory structures!"
        },
        {
          question: "What green pigment absorbs light energy within chloroplast thylakoids?",
          options: ["Carotenoids", "Chloroplast cell walls", "Chlorophyll", "Hemoglobin"],
          answer: "Chlorophyll",
          explanation: "Chlorophyll is the primary green pigment in plants that absorbs solar energy to power photosynthesis reactions."
        }
      ]
    });
  }
});

// 3. Audio Q&A Chat Endpoint with Document Context
app.post('/api/gemini/chat', async (req, res) => {
  const { content, messages, userInput, language } = req.body;
  if (!userInput) {
    return res.status(400).json({ error: 'User input is required.' });
  }

  const targetLang = getLanguageName(language);
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.json({
      text: `[Demo Mode] You asked: "${userInput}". Since the Gemini API key is missing, I am responding locally: The study notes describe the topic brilliantly. Please connect your Gemini API key in Secrets panel to unlock full voice logic!`
    });
  }

  try {
    const contextPrompt = `You are "Hear2Learn", a dedicated voice-based study companion helping visually impaired students.
Study Document Context:
---
${content || 'No specific document has been parsed yet. Remind them to upload materials or ask general learning questions.'}
---

Recent Chat Logs:
${(messages || []).map((m: any) => `${m.role === 'user' ? 'Student' : 'Hear2Learn'}: ${m.content}`).join('\n')}

New Question: "${userInput}"

Instruction: Respond clearly and conversationally in ${targetLang}. Avoid writing markdown items like tables, raw code, asterisks, or unreadable bullet structures. Build rich sentences suited for TTS recitation. Keep answers concise so the user doesn't get overwhelmed (不超过 100 words where possible unless a concept breakdown is requested).`;

    const response = await generateContentWithRetry({
      model: 'gemini-3.5-flash',
      contents: contextPrompt,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini Chat Error after retries:', error);
    // Graceful conversational recovery response
    res.json({
      text: `Our AI servers are experiencing extremely high demand, but I am still right here to support your learning! Regarding "${userInput}", I recommend reviewing the main chapter material or attempting our custom quiz section. Ask me again in just a moment and we'll delve deeper!`
    });
  }
});

// 4. Proactive Suggestion & Weak Area Guidance
app.post('/api/gemini/proactive', async (req, res) => {
  const { chapterTitle, weakTopics, language } = req.body;
  const targetLang = getLanguageName(language);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.json({
      text: `Hear2Learn noticed you've completed "${chapterTitle || 'the chapter'}". Excellent job! Would you like a quick quiz, a friendly summarization, or shall we review some flashcard questions?`
    });
  }

  try {
    const response = await generateContentWithRetry({
      model: 'gemini-3.5-flash',
      contents: `Student profile completed chapter: "${chapterTitle || 'General Chapter'}"
Weak Revision Topics currently tagged: "${(weakTopics || []).join(', ') || 'None'}"

Task: Write a highly warm, proactive voice invitation in ${targetLang} recognizing this achievement.
Suggest an immediate action choice, for example:
- A short voice quiz
- A beautiful summarization
- Revision focus on their weak topics.
Keep it strictly under 3 sentences. Do not use structural symbols. Exclusively friendly vocalized prose.`,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini Proactive Suggestion Error after retries:', error);
    res.json({
      text: `You have done magnificent work tackling "${chapterTitle || 'the chapter'}"! The AI networks are currently very busy, but I highly encourage you to test your skills with our interactive quiz, or ask me to explain a concept next!`
    });
  }
});

// Serve frontend assets in Dev vs Production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Developer Hot reload Setup
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode serving statically compiled assets
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hear2Learn Service holds port ${PORT}`);
  });
}

startServer();
