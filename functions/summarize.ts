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
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return res.status(500).json({ error: 'OpenRouter API key is not configured in Nhost secrets.' });
    }

    let summary = '';
    const FREE_MODELS = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free'
    ];

    let lastError = '';
    for (const model of FREE_MODELS) {
      try {
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
            break; // Successfully got summary, exit loop
          }
        } else {
          const errorData = await aiResponse.text();
          lastError = `Model ${model} failed: ${errorData || aiResponse.statusText}`;
        }
      } catch (err: any) {
        lastError = `Model ${model} request error: ${err.message}`;
      }
    }

    if (!summary) {
      return res.status(502).json({ error: `All free models failed or were rate-limited. Last error: ${lastError}` });
    }

    return res.status(200).json({
      success: true,
      videoTitle,
      channelTitle,
      thumbnailUrl,
      duration,
      summary,
      transcript: truncatedTranscript,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'An error occurred during video processing.' });
  }
}
