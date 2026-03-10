/**
 * Centralized Prompt Management
 * 
 * This file contains all AI prompts used in the RedEngine application.
 * Currently used with OpenAI's gpt-4o-mini model.
 * 
 * Usage:
 *   import { PROMPTS } from './prompts.js';
 *   const response = await callOpenAI(PROMPTS.SPEECH_TYPE_CLASSIFICATION(postContent));
 */

export const PROMPTS = {
  /**
   * SPEECH TYPE CLASSIFICATION
   * 
   * Purpose: Classify Reddit posts into one or more categories based on primary intent
   * Used in: /api/calibrate, /api/calibrate-single-post
   * Output: Comma-separated tags (e.g., "pain_conveying,advice_solution")
   */
  SPEECH_TYPE_CLASSIFICATION: (postContent) => `You are analyzing Reddit posts and must classify each post based on the primary intent of the text. Assign the following tags: pain_conveying, advice_solution, or narrative_experience. A post can have none or all of the tags.

Use pain_conveying when the author is expressing a problem, frustration, difficulty, confusion, or asking for help.
Use advice_solution when the author is primarily giving guidance, instructions, recommendations, or proposing a fix or method to solve a problem.
Use narrative_experience when the author is mainly telling a story, sharing a personal journey, describing what happened to them, or recounting past events without focusing on asking for help or giving direct solutions.

Base your decision on the dominant intention of the post, not isolated sentences.

Post content:
${postContent}

Respond with ONLY the tag names separated by commas (e.g., "pain_conveying,advice_solution" or "narrative_experience" or leave empty if none apply). No other text.`,

  /**
   * AI SUMMARY GENERATION
   * 
   * Purpose: Create semantic search-optimized summary of Reddit posts
   * Used in: /api/calibrate, /api/calibrate-single-post
   * Output: 1-3 sentence summary optimized for embeddings
   */
  AI_SUMMARY: (postContent) => `You are creating a summary of a Reddit post optimized for embedding/semantic search. The summary should:
- Emphasize keywords and semantic meaning
- Include all important information from the post
- Be concise but comprehensive (1-3 sentences)
- Preserve the key intent and context
- Use clear, direct language

Post content:
${postContent}

Write only the summary, nothing else.`,

  /**
   * SPEECH DETAIL - EMBEDDING-FRIENDLY DESCRIPTIONS
   * 
   * Purpose: Generate detailed descriptions for each applicable speech type tag
   * Used in: /api/calibrate, /api/calibrate-single-post, /api/fetch-speech-detail
   * Output: JSON object with keys: pain_conveying, advice_solution, narrative_experience
   * 
   * @param {string} postContent - The post content to analyze
   * @param {string[]} tags - Array of tags that apply to this post
   */
  /**
   * ENTITIES AND LINKS EXTRACTION
   *
   * Purpose: Extract every entity mentioned in the post and context of outbound links
   * Used in: /api/calibrate, /api/calibrate-single-post
   * Output: JSON object with fields: entities (array), links (array of {platform, context} objects)
   */
  ENTITIES_AND_LINKS_EXTRACTION: (postContent) => `You are an exhaustive entity extractor. Your job is to find and list EVERY single entity mentioned in this Reddit post — do not skip anything, no matter how minor it seems.

Entities include ALL of the following — extract every instance:
- People: any names, usernames, public figures, authors, developers
- Organizations: companies, startups, communities, subreddits, teams, platforms
- Products & Tools: software, apps, libraries, frameworks, services, APIs, hardware
- Problems & Issues: any pain points, bugs, challenges, frustrations, blockers
- Solutions & Actions: fixes, workarounds, recommendations, methods, approaches
- Locations: countries, cities, regions, URLs used as locations
- Metrics & Numbers: stats, counts, prices, durations, versions, percentages (avoid generic numbers like "many", "some", "1", "2" unless they are clearly significant in context)
- Concepts & Topics: technical terms, domain concepts, abstract ideas mentioned
- Events: any incidents, releases, updates, announcements referenced

CRITICAL: Be EXHAUSTIVE. If in doubt, include it. Missing entities is a failure. Every noun phrase, every specific term, every named thing must be captured.

For links: for each link/URL mentioned, identify:
- platform: the SPECIFIC website or platform name — NEVER use generic labels like "Website" or "Link". Always identify the actual site name. If the URL is visible, use the domain name (e.g. "nomadlist.com", "seat61.com", "rome2rio.com"). If it's a well-known platform, use its proper name (e.g. "Instagram", "YouTube", "GitHub", "Twitter", "Discord", "Reddit", "Medium", "Substack", "TikTok", "LinkedIn", "Wikipedia", "Patreon", "Amazon", "Google Maps", "Booking.com"). If you cannot determine the exact site, use the domain from the URL. NEVER output "Website" as a platform name.
- context: the purpose or topic of the link (e.g. "tutorial on setting up X", "official documentation", "personal profile"). Do NOT include the actual URL.

Post content:
${postContent}

Respond with ONLY this JSON structure (no other text):
{"entities": [...], "links": [{"platform": "...", "context": "..."}]}`,

  SPEECH_DETAIL: (postContent, tags) => `You are creating keyword-focused, embedding-optimized descriptions for Reddit post content. Extract ONLY the key concepts and important words/phrases - no full sentences.

Tags and instructions:
- pain_conveying: If this tag applies, extract the key problem/pain words: what is the issue, pain points, concerns, difficulties. Use short phrases with important keywords only.
- advice_solution: If this tag applies, extract the key solution/advice words: what advice is given, what solutions proposed, key recommendations. Use short phrases with important keywords only.
- narrative_experience: If this tag applies, extract the key story/experience words: what happened, key events, personal journey elements. Use short phrases with important keywords only.

Rules:
- Use ONLY keywords and short phrases (3-7 words max per phrase)
- Remove unnecessary words like "the", "and", "is", "are", "to", "that"
- Extract semantic meaning through key terms, not full sentences
- Focus on nouns, verbs, and descriptive words that carry meaning
- If a tag does NOT apply, use null for that field
- Return ONLY valid JSON with exactly these 3 fields

Post content:
${postContent}

Applied tags: ${tags.join(', ')}

Respond with ONLY this JSON structure (no other text):
{"pain_conveying": "...", "advice_solution": "...", "narrative_experience": "..."}`,
};

/**
 * OpenAI Configuration for Prompts
 * 
 * These settings apply to all prompt calls
 */
export const OPENAI_CONFIG = {
  model: 'gpt-4o-mini',
  temperature: 0.3,        // Deterministic, focused responses
  max_tokens: 500,
};

/**
 * Prompt Usage Guide
 * 
 * 1. Speech Type Classification
 *    - Required input: postContent (string)
 *    - Expected output: comma-separated tags or empty string
 *    - Example: "pain_conveying,advice_solution"
 * 
 * 2. AI Summary
 *    - Required input: postContent (string)
 *    - Expected output: 1-3 sentence summary optimized for embeddings
 *    - Example: "User concerned about tight travel schedule, seeking advice on adjusting itinerary"
 * 
 * 3. Speech Detail (Keyword-Focused)
 *    - Required inputs: postContent (string), tags (array)
 *    - Expected output: JSON object with keyword phrases (not full sentences)
 *    - Example: {
 *        "pain_conveying": "tight schedule, packed itinerary, stressful travel",
 *        "advice_solution": "adjust itinerary, find accommodations, local recommendations",
 *        "narrative_experience": null
 *      }
 * 
 * Best Practices:
 * - Always concatenate subreddit name, title, and selftext for postContent
 * - Process in batches to avoid rate limiting
 * - Cache results to minimize API calls
 * - Monitor token usage
 * - Speech detail keywords work better for embeddings than full sentences - they capture essence with less noise
 */
