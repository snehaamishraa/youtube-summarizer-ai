import { Request, Response } from 'express';
import { YoutubeTranscript } from 'youtube-transcript';

// Utility to extract YouTube video ID
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|^shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default async function handler(req: Request, res: Response) {
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
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  const videoId = getYouTubeId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    // 1. Fetch video page metadata and description
    let videoTitle = 'Unknown YouTube Video';
    let channelTitle = 'Unknown Channel';
    let duration = 0;
    let videoDescription = '';
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    try {
      const ytResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (ytResponse.ok) {
        const html = await ytResponse.text();

        // Title match
        const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) || 
                           html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch) {
          videoTitle = titleMatch[1].replace(' - YouTube', '');
        }

        // Channel title match
        const channelMatch = html.match(/<link\s+itemprop="name"\s+content="([^"]*)"/i) || 
                             html.match(/"author"\s*:\s*"([^"]*)"/i);
        if (channelMatch) {
          channelTitle = channelMatch[1];
        }

        // Duration match
        const durationMatch = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/i) || 
                              html.match(/"lengthSeconds"\s*:\s*"(\d+)"/i);
        if (durationMatch) {
          duration = Math.floor(parseInt(durationMatch[1], 10) / (durationMatch[0].includes('approxDurationMs') ? 1000 : 1));
        }

        // Description meta match
        const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || 
                          html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
        if (descMatch) {
          videoDescription = descMatch[1];
        }

        // Parse ytInitialPlayerResponse fallback
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (playerResponseMatch) {
          try {
            const data = JSON.parse(playerResponseMatch[1]);
            const details = data.videoDetails;
            if (details) {
              if (details.title && videoTitle === 'Unknown YouTube Video') videoTitle = details.title;
              if (details.author && channelTitle === 'Unknown Channel') channelTitle = details.author;
              if (details.lengthSeconds && !duration) duration = parseInt(details.lengthSeconds, 10);
              if (details.shortDescription && !videoDescription) videoDescription = details.shortDescription;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (e) {
      // If fetching page metadata fails, we still proceed with default values
    }

    // 2. Fetch transcript using youtube-transcript (with silent failure on rate-limit/datacenter blocks)
    let transcriptText = '';
    try {
      const transcriptObj = await YoutubeTranscript.fetchTranscript(videoId);
      transcriptText = transcriptObj.map((item) => item.text).join(' ');
    } catch (err: any) {
      console.warn('Transcript fetch failed (likely blocked by YouTube datacenter IP security):', err.message);
    }

    let contentToSummarize = transcriptText.trim();
    if (!contentToSummarize) {
      if (videoDescription.trim()) {
        contentToSummarize = `Video Description: ${videoDescription.trim()}`;
      } else {
        return res.status(400).json({ 
          error: 'Transcripts are disabled or blocked by YouTube, and no video description could be retrieved. Please try another video.' 
        });
      }
    }

    // Truncate to protect context window limits
    const truncatedTranscript = contentToSummarize.slice(0, 45000);

    // 3. Connect to OpenRouter API to generate summary (using free models only)
    const rawKey = process.env.OPENROUTER_API_KEY || '';
    const openRouterKey = rawKey.replace(/^['"]|['"]$/g, '').trim();
    if (!openRouterKey) {
      return res.status(500).json({ error: 'OpenRouter API key is not configured in Nhost secrets.' });
    }

    let summary = '';
    let successfulModel = '';
    const FREE_MODELS = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
      'nousresearch/hermes-3-llama-3.1-405b:free'
    ];

    let lastError = '';
    const errors: string[] = [];
    for (const model of FREE_MODELS) {
      try {
        console.log(`Attempting to summarize using model: ${model}`);
        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://github.com/snehaamishraa/youtube-summarizer-ai',
            'X-Title': 'Notiora AI',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `You are a professional video summarizer. Analyze the transcript of the video and generate a structured summary.
Your response must consist of exactly three sections separated by double newlines:
1. A concise paragraph summarizing the main theme of the video.
2. A bulleted list containing exactly 5 key concepts, each starting with a bullet character "•" (not "-" or "*").
3. A "Key Takeaway" section summarizing the final conclusion or lesson.
Format the output in clean markdown.`,
              },
              {
                role: 'user',
                content: `Video Title: ${videoTitle}\nChannel: ${channelTitle}\n\nTranscript: ${truncatedTranscript}`,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          summary = aiData.choices?.[0]?.message?.content || '';
          if (summary) {
            successfulModel = model;
            console.log(`Successfully generated summary using model: ${model}`);
            break; // Successfully got summary, exit loop
          }
        } else {
          const errorData = await aiResponse.text();
          const errStr = `Model ${model} failed (HTTP ${aiResponse.status}): ${errorData || aiResponse.statusText}`;
          errors.push(errStr);
          console.warn(errStr);
        }
      } catch (err: any) {
        const errStr = `Model ${model} request error: ${err.message}`;
        errors.push(errStr);
        console.error(errStr);
      }
    }

    lastError = errors.join(' | ');

    if (!summary) {
      const keyLength = openRouterKey.length;
      const maskedKey = keyLength > 10 
        ? `${openRouterKey.slice(0, 8)}...${openRouterKey.slice(-4)}` 
        : 'Too short / Empty';
      console.error(`AI Summary Generation Failed. Last Error: ${lastError} (Key debug: len=${keyLength}, mask=${maskedKey})`);
      return res.status(502).json({ 
        error: 'The AI summarization service is temporarily busy or rate-limited. Please wait a moment and try again.' 
      });
    }

    return res.status(200).json({
      success: true,
      videoTitle,
      channelTitle,
      thumbnailUrl,
      duration,
      summary,
      transcript: truncatedTranscript,
      modelUsed: getFriendlyModelName(successfulModel),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'An error occurred during video processing.' });
  }
}

function getFriendlyModelName(modelSlug: string): string {
  if (modelSlug.includes('llama-3.1')) return 'Meta Llama 3.1';
  if (modelSlug.includes('llama-3.3')) return 'Meta Llama 3.3';
  if (modelSlug.includes('llama-3.2')) return 'Meta Llama 3.2';
  if (modelSlug.includes('gemma-4')) return 'Google Gemma 4';
  if (modelSlug.includes('qwen3-coder')) return 'Qwen 3 Coder';
  if (modelSlug.includes('gemma-2')) return 'Google Gemma 2';
  if (modelSlug.includes('mistral')) return 'Mistral 7B';
  return 'AI Assistant';
}
