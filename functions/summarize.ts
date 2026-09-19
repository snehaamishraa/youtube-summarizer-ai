import { Request, Response } from 'express';

// Step 2 of 2 (Hasura Action "summarizeVideo"): turn the transcript from step 1 (transcript.ts)
// into a summary and save it. Nhost's Starter plan stops a function after 10 seconds,
// so we stop trying AI models after this point, leaving time to save to the database.
const AI_DEADLINE_MS = 8500;

// Longest transcript we send to the AI, to protect the models' context window limits
const MAX_TRANSCRIPT_CHARS = 45000;

// Free OpenRouter models, fastest first. The first two are asked at the same time;
// the rest are backups, tried one by one until one returns a summary.
const FREE_MODELS = [
  { id: 'nex-agi/nex-n2.5-mini:free', name: 'Nex N2.5 Mini' },
  { id: 'cohere/north-mini-code:free', name: 'Cohere North Mini' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Google Gemma 4' },
  { id: 'qwen/qwen3.8-27b:free', name: 'Qwen 3.8' },
  { id: 'google/gemma-4-31b-it:free', name: 'Google Gemma 4 31B' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nvidia Nemotron 3 Super' },
];

const SYSTEM_PROMPT = `You are a professional video summarizer. You will receive the transcript of a YouTube video.
Summarize only what is said in the transcript. Do not add outside information and do not describe YouTube itself.
Always write in English, even if the transcript is in another language.
Reply in exactly this plain-text format, with no markdown symbols like ** or #:

SUMMARY:
<one paragraph of 4-6 sentences explaining what the video is about and its main message>

KEY POINTS:
• <point 1>
• <point 2>
• <point 3>
• <point 4>
• <point 5>

KEY TAKEAWAY:
<one or two sentences with the final lesson or conclusion>`;

interface ModelResult {
  summary: string;
  modelUsed: string;
}

// Secrets pasted into Nhost sometimes come with quotes around them, which breaks HTTP headers
function readSecret(name: string): string {
  return (process.env[name] || '').replace(/^['"]|['"]$/g, '').trim();
}

// Ask one OpenRouter model for a summary. Throws if the model fails, times out or returns nothing.
async function askModel(
  model: { id: string; name: string },
  apiKey: string,
  userContent: string,
  timeoutMs: number
): Promise<ModelResult> {
  console.log(`Attempting to summarize using model: ${model.id}`);
  const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/snehaamishraa/youtube-summarizer-ai',
      'X-Title': 'Notiora AI',
    },
    body: JSON.stringify({
      model: model.id,
      // Skip the model's "thinking" step: it makes answers much slower and we don't need it here
      reasoning: { enabled: false },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  }).catch((err) => {
    throw new Error(`Model ${model.id} request error: ${err.message}`);
  });

  if (!aiResponse.ok) {
    throw new Error(`Model ${model.id} failed (HTTP ${aiResponse.status}): ${await aiResponse.text()}`);
  }

  const aiData = await aiResponse.json();
  const summary = (aiData.choices?.[0]?.message?.content || '').trim();
  if (!summary) {
    throw new Error(`Model ${model.id} returned an empty summary`);
  }

  console.log(`Successfully generated summary using model: ${model.id}`);
  return { summary, modelUsed: model.name };
}

export default async function handler(req: Request, res: Response) {
  const startedAt = Date.now();

  // This function is only called by Hasura (Action "summarizeVideo")
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { url, videoId, videoTitle, channelTitle, duration, transcript } = req.body?.input || {};
  const userId = req.body?.session_variables?.['x-hasura-user-id'];

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: User session is required' });
  }

  if (!url || !/^[\w-]{11}$/.test(videoId || '')) {
    return res.status(400).json({ message: 'Invalid YouTube URL' });
  }

  if (!transcript?.trim()) {
    return res.status(400).json({ message: 'Transcript is required' });
  }

  try {
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const truncatedTranscript = transcript.slice(0, MAX_TRANSCRIPT_CHARS);

    // 1. Connect to OpenRouter API to generate summary (using free models only)
    const openRouterKey = readSecret('OPENROUTER_API_KEY');
    if (!openRouterKey) {
      return res.status(500).json({ message: 'OpenRouter API key is not configured in Nhost secrets.' });
    }

    const userContent = `Video Title: ${videoTitle}\nChannel: ${channelTitle}\n\nTranscript: ${truncatedTranscript}`;
    // Models only get the time we have left, so we never hit the platform timeout
    const timeLeft = () => AI_DEADLINE_MS - (Date.now() - startedAt);
    const errors: string[] = [];
    let result: ModelResult | null = null;

    // Ask the two fastest models at the same time and keep whichever answers first
    const [first, second, ...rest] = FREE_MODELS;
    try {
      result = await Promise.any(
        [first, second].map((model) => askModel(model, openRouterKey, userContent, timeLeft()))
      );
    } catch (err: any) {
      errors.push(...err.errors.map((e: Error) => e.message));
    }

    // If both failed, try the remaining models one by one while there is time left
    for (const model of rest) {
      if (result) break;
      if (timeLeft() < 1000) {
        errors.push('Ran out of time before trying the remaining models');
        break;
      }
      try {
        result = await askModel(model, openRouterKey, userContent, timeLeft());
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    if (!result) {
      console.error(`AI Summary Generation Failed. Errors: ${errors.join(' | ')}`);
      return res.status(502).json({
        message: 'The AI summarization service is temporarily busy or rate-limited. Please wait a moment and try again.',
      });
    }

    const { summary, modelUsed } = result;

    // 2. Save to PostgreSQL via GraphQL Mutation on the backend
    const hasuraAdminSecret = process.env.NHOST_ADMIN_SECRET;
    const hasuraUrl = process.env.NHOST_GRAPHQL_URL || `${process.env.NHOST_BACKEND_URL}/v1/graphql`;

    const graphqlMutation = `
      mutation InsertSummary(
        $videoId: String!
        $videoUrl: String!
        $videoTitle: String!
        $channelTitle: String!
        $thumbnailUrl: String!
        $duration: Int!
        $summary: String!
        $transcript: String
      ) {
        insertSummary(
          object: {
            videoId: $videoId
            videoUrl: $videoUrl
            videoTitle: $videoTitle
            channelTitle: $channelTitle
            thumbnailUrl: $thumbnailUrl
            duration: $duration
            summary: $summary
            transcript: $transcript
          }
        ) {
          id
        }
      }
    `;

    let savedSummaryId = '';

    try {
      const dbResponse = await fetch(hasuraUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': hasuraAdminSecret || '',
          'x-hasura-role': 'user',
          'x-hasura-user-id': userId,
        },
        body: JSON.stringify({
          query: graphqlMutation,
          variables: {
            videoId,
            videoUrl: url,
            videoTitle,
            channelTitle,
            thumbnailUrl,
            duration,
            summary,
            transcript: truncatedTranscript,
          },
        }),
      });

      if (!dbResponse.ok) {
        const errorText = await dbResponse.text();
        console.error('Failed to save summary to database:', errorText);
        return res.status(500).json({ message: `Database save failed: HTTP ${dbResponse.status}` });
      }

      const dbData = await dbResponse.json();
      if (dbData.errors) {
        console.error('GraphQL errors saving summary:', dbData.errors);
        return res.status(500).json({ message: `Database save failed: ${dbData.errors[0]?.message || 'GraphQL error'}` });
      }

      savedSummaryId = dbData.data?.insertSummary?.id;
      if (!savedSummaryId) {
        throw new Error('No ID returned from database insert');
      }
    } catch (dbErr: any) {
      console.error('Error inserting summary into database:', dbErr.message);
      return res.status(500).json({ message: `Database insert error: ${dbErr.message}` });
    }

    console.log(`Summary saved in ${Date.now() - startedAt}ms`);

    return res.status(200).json({
      id: savedSummaryId,
      videoTitle,
      channelTitle,
      thumbnailUrl,
      duration,
      summary,
      modelUsed,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'An error occurred during video processing.' });
  }
}
