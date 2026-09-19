import { Request, Response } from 'express';
import { YoutubeTranscript } from 'youtube-transcript';

// Nhost's Starter plan stops a function after 10 seconds.
// We stop trying AI models after this point, leaving time to save to the database.
const AI_DEADLINE_MS = 8500;

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

interface Transcript {
  text: string;
  durationSec: number;
}

interface TranscriptChunk {
  text: string;
  offset: number;
  duration: number;
}

// Utility to extract YouTube video ID
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Secrets pasted into Nhost sometimes come with quotes around them, which breaks HTTP headers
function readSecret(name: string): string {
  return (process.env[name] || '').replace(/^['"]|['"]$/g, '').trim();
}

// Title and channel name from YouTube's public oEmbed endpoint (no API key needed)
async function fetchVideoInfo(videoUrl: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
    if (res.ok) {
      const data = await res.json();
      return {
        videoTitle: data.title || 'Unknown YouTube Video',
        channelTitle: data.author_name || 'Unknown Channel',
      };
    }
  } catch (err: any) {
    console.warn('oEmbed lookup failed:', err.message);
  }
  return { videoTitle: 'Unknown YouTube Video', channelTitle: 'Unknown Channel' };
}

// Supadata transcript API. Works from cloud servers, which YouTube usually blocks.
// Needs the SUPADATA_API_KEY secret. Chunk offsets and durations are in milliseconds.
async function fetchTranscriptFromSupadata(videoUrl: string): Promise<Transcript | null> {
  const apiKey = readSecret('SUPADATA_API_KEY');
  if (!apiKey) {
    console.warn('SUPADATA_API_KEY is not set, skipping Supadata');
    return null;
  }

  const toTranscript = (chunks: TranscriptChunk[]): Transcript | null => {
    if (!Array.isArray(chunks) || chunks.length === 0) return null;
    const last = chunks[chunks.length - 1];
    return {
      text: chunks.map((chunk) => chunk.text).join(' ').trim(),
      durationSec: Math.round((last.offset + last.duration) / 1000),
    };
  };

  try {
    const headers = { 'x-api-key': apiKey };
    const res = await fetch(
      `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}&lang=en&mode=native`,
      { headers }
    );

    // 202 = Supadata is processing a long video as a background job. Poll briefly.
    if (res.status === 202) {
      const { jobId } = await res.json();
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const job = await (await fetch(`https://api.supadata.ai/v1/transcript/${jobId}`, { headers })).json();
        if (job.status === 'completed') return toTranscript(job.content);
        if (job.status === 'failed') break;
      }
      console.warn('Supadata transcript job did not finish in time');
      return null;
    }

    if (!res.ok) {
      console.warn(`Supadata transcript failed (HTTP ${res.status}):`, await res.text());
      return null;
    }

    const data = await res.json();
    return toTranscript(data.content);
  } catch (err: any) {
    console.warn('Supadata request error:', err.message);
    return null;
  }
}

// Free youtube-transcript library. Works from normal IPs (like local development),
// but YouTube usually blocks cloud servers.
async function fetchTranscriptFromYouTube(videoId: string): Promise<Transcript | null> {
  // Prefer English captions, otherwise take whatever language the video has
  for (const config of [{ lang: 'en' }, undefined]) {
    try {
      const chunks = await YoutubeTranscript.fetchTranscript(videoId, config);
      const text = chunks.map((chunk) => chunk.text).join(' ').trim();
      // This library mixes seconds and milliseconds depending on caption format, so we skip duration
      if (text) return { text, durationSec: 0 };
    } catch (err: any) {
      console.warn(`youtube-transcript failed (lang=${config?.lang ?? 'default'}):`, err.message);
    }
  }
  return null;
}

async function getTranscript(videoId: string, videoUrl: string): Promise<Transcript | null> {
  return (await fetchTranscriptFromSupadata(videoUrl)) ?? (await fetchTranscriptFromYouTube(videoId));
}

interface ModelResult {
  summary: string;
  modelUsed: string;
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

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-hasura-role');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { url } = req.body?.input || {};
  const sessionVariables = req.body?.session_variables || {};
  const userId = sessionVariables['x-hasura-user-id'];

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: User session is required' });
  }

  if (!url) {
    return res.status(400).json({ message: 'YouTube URL is required' });
  }

  const videoId = getYouTubeId(url);
  if (!videoId) {
    return res.status(400).json({ message: 'Invalid YouTube URL' });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    // 1. Fetch video title/channel and the transcript at the same time
    const [{ videoTitle, channelTitle }, transcript] = await Promise.all([
      fetchVideoInfo(videoUrl),
      getTranscript(videoId, videoUrl),
    ]);

    // Without a transcript we refuse, instead of summarizing something unrelated
    if (!transcript) {
      return res.status(400).json({
        message: 'Could not get the transcript for this video. Please try a video that has captions/subtitles.',
      });
    }

    // Truncate to protect context window limits
    const truncatedTranscript = transcript.text.slice(0, 45000);
    const duration = transcript.durationSec;

    // 2. Connect to OpenRouter API to generate summary (using free models only)
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

    // 3. Save to PostgreSQL via GraphQL Mutation on the backend
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
