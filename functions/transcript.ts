import { Request, Response } from 'express';
import { YoutubeTranscript } from 'youtube-transcript';

// Step 1 of 2 (Hasura Action "fetchTranscript"): get the video's title, channel and transcript.
// The AI summary is made in a separate function (summarize.ts), because Nhost's Starter plan
// stops a function after 10 seconds and one long video can need more than that for both steps.
const DEADLINE_MS = 8500;

// Longest transcript we send to the AI, to protect the models' context window limits
const MAX_TRANSCRIPT_CHARS = 45000;

interface Transcript {
  text: string;
  durationSec: number;
}

interface TranscriptChunk {
  text: string;
  offset: number;
  duration: number;
}

// Utility to extract the 11-character YouTube video ID. Supports links like
// watch?v=ID, youtu.be/ID, /shorts/ID, /live/ID, /embed/ID and /v/ID
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live|v)\/)([\w-]{11})(?![\w-])/);
  return match ? match[1] : null;
}

// Secrets pasted into Nhost sometimes come with quotes around them, which breaks HTTP headers
function readSecret(name: string): string {
  return (process.env[name] || '').replace(/^['"]|['"]$/g, '').trim();
}

// Title and channel name from YouTube's public oEmbed endpoint (no API key needed)
async function fetchVideoInfo(videoUrl: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, {
      signal: AbortSignal.timeout(3000),
    });
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
async function fetchTranscriptFromSupadata(videoUrl: string, deadline: number): Promise<Transcript | null> {
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
      { headers, signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)) }
    );

    // 202 = Supadata is processing a long video as a background job. Poll while we have time.
    if (res.status === 202) {
      const { jobId } = await res.json();
      while (Date.now() + 1500 < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const jobRes = await fetch(`https://api.supadata.ai/v1/transcript/${jobId}`, {
          headers,
          signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1)),
        });
        const job = await jobRes.json();
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

export default async function handler(req: Request, res: Response) {
  const deadline = Date.now() + DEADLINE_MS;

  // This function is only called by Hasura (Action "fetchTranscript")
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { url } = req.body?.input || {};
  const userId = req.body?.session_variables?.['x-hasura-user-id'];

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: User session is required' });
  }

  const videoId = getYouTubeId(url || '');
  if (!videoId) {
    return res.status(400).json({ message: 'Invalid YouTube URL' });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Fetch title/channel and the transcript at the same time.
    // Supadata first; the free library is a backup if there is still time left.
    const [info, transcript] = await Promise.all([
      fetchVideoInfo(videoUrl),
      fetchTranscriptFromSupadata(videoUrl, deadline).then((result) =>
        result ?? (deadline - Date.now() > 2000 ? fetchTranscriptFromYouTube(videoId) : null)
      ),
    ]);

    // Without a transcript we stop here, instead of summarizing something unrelated
    if (!transcript) {
      return res.status(400).json({
        message: 'Could not get the transcript for this video. Please try a video that has captions/subtitles.',
      });
    }

    return res.status(200).json({
      videoId,
      videoTitle: info.videoTitle,
      channelTitle: info.channelTitle,
      duration: transcript.durationSec,
      transcript: transcript.text.slice(0, MAX_TRANSCRIPT_CHARS),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'An error occurred while fetching the transcript.' });
  }
}
