import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import pkg from 'pg';
import UmapJs from 'umap-js';
import { PROMPTS, OPENAI_CONFIG } from './prompts.js';

dotenv.config();

const { Pool } = pkg;
const UMAP = UmapJs.UMAP;
const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize database table on startup
async function initializeDatabase() {
  try {
    // Create UUID extension if it doesn't exist
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reddit_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id VARCHAR(255) UNIQUE NOT NULL,
        title TEXT NOT NULL,
        author VARCHAR(255),
        score INTEGER,
        comments INTEGER,
        upvote_ratio FLOAT,
        ups INTEGER,
        selftext TEXT,
        url TEXT,
        created TIMESTAMP,
        subreddit VARCHAR(255),
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        comments_last_fetched TIMESTAMP,
        speech_type TEXT[] DEFAULT NULL,
        ai_summary TEXT DEFAULT NULL
      )
    `);

    // Add comments_last_fetched column if it doesn't exist (for existing tables)
    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS comments_last_fetched TIMESTAMP
    `);

    // Add speech_type and ai_summary columns if they don't exist
    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS speech_type TEXT[] DEFAULT NULL
    `);

    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS ai_summary TEXT DEFAULT NULL
    `);

    // Add speech_detail column if it doesn't exist
    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS speech_detail JSONB DEFAULT NULL
    `);

    // Add entities column if it doesn't exist
    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS entities TEXT[] DEFAULT NULL
    `);

    // Add links column if it doesn't exist (JSONB to store platform + context objects)
    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS links JSONB DEFAULT NULL
    `);

    // Add embedding column if it doesn't exist
    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS embedding JSONB DEFAULT NULL
    `);

    // Add embedding_vector column if it doesn't exist (stores 1536D vectors)
    await pool.query(`
      ALTER TABLE reddit_posts 
      ADD COLUMN IF NOT EXISTS embedding_vector VECTOR(1536) DEFAULT NULL
    `).catch(() => {
      // If vector type doesn't exist, we'll store as FLOAT8[]
      return pool.query(`
        ALTER TABLE reddit_posts 
        ADD COLUMN IF NOT EXISTS embedding_vector FLOAT8[] DEFAULT NULL
      `);
    });

    // Create reddit_comments table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reddit_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id VARCHAR(255) UNIQUE,
        post_id VARCHAR(255),
        parent_id VARCHAR(255),
        author VARCHAR(255),
        body TEXT,
        ups INTEGER,
        downs INTEGER,
        num_replies INTEGER,
        created TIMESTAMP,
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✓ Database table initialized with UUID support');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
  }
}

// Call initialization on startup
initializeDatabase();


// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(express.json({ limit: '50mb' }));

// Store access token
let redditAccessToken = null;
let tokenExpiry = null;

// Base64 encode credentials for Reddit API
const auth = Buffer.from(
  `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
).toString('base64');

// Function to get access token using Client Credentials flow
async function getAccessToken() {
  try {
    // Check if token is still valid
    if (redditAccessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return redditAccessToken;
    }

    console.log('Requesting new Reddit access token...');

    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': process.env.REDDIT_USER_AGENT || 'RedEngine/0.0.1',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Reddit auth failed: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    redditAccessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);

    console.log('✓ Reddit access token obtained');
    return redditAccessToken;
  } catch (error) {
    console.error('Failed to get Reddit access token:', error.message);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RedEngine backend is running' });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ready',
    engine: 'RedEngine',
    version: '0.0.1',
    redditConnected: !!redditAccessToken,
    timestamp: new Date().toISOString(),
  });
});

// Migrate comments_last_fetched data from existing comments
app.post('/api/migrate-comment-dates', async (req, res) => {
  try {
    console.log('Starting migration of comments_last_fetched...');

    // Find all posts with comments and get their latest fetch date
    const result = await pool.query(`
      UPDATE reddit_posts
      SET comments_last_fetched = (
        SELECT MAX(fetched_at)
        FROM reddit_comments
        WHERE reddit_comments.post_id = reddit_posts.post_id
      )
      WHERE post_id IN (
        SELECT DISTINCT post_id FROM reddit_comments
      )
      RETURNING post_id, comments_last_fetched
    `);

    console.log(`✓ Migration complete: Updated ${result.rowCount} posts with comment fetch dates`);

    res.json({
      status: 'success',
      message: `Migrated ${result.rowCount} posts with comment fetch dates`,
      updatedPosts: result.rowCount,
      details: result.rows.slice(0, 10), // Show first 10 for reference
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      error: error.message || 'Failed to migrate comment dates',
      details: error.message,
    });
  }
});

// Get all subreddits from database
app.get('/api/subreddits', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT subreddit FROM reddit_posts WHERE embedding_vector IS NOT NULL ORDER BY subreddit ASC`
    );

    const subreddits = result.rows.map(row => row.subreddit).filter(Boolean);

    res.json({
      status: 'success',
      subreddits,
      count: subreddits.length,
    });
  } catch (error) {
    console.error('Failed to fetch subreddits:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch subreddits',
    });
  }
});

// Get posts from a specific subreddit from database
app.get('/api/subreddit/:subreddit/posts', async (req, res) => {
  const { subreddit } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM reddit_posts WHERE subreddit = $1 ORDER BY created DESC`,
      [subreddit]
    );

    res.json({
      status: 'success',
      subreddit,
      posts: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch posts',
    });
  }
});

// Fetch embeddings for a subreddit by metric
app.get('/api/embeddings/:subreddit/:metric', async (req, res) => {
  const { subreddit, metric } = req.params;
  const { includeMetadata } = req.query;

  // Validate metric
  const validMetrics = ['ai', 'pain', 'advice', 'narrative'];
  if (!validMetrics.includes(metric)) {
    return res.status(400).json({
      error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`,
    });
  }

  try {
    const xField = `${metric}_x`;
    const yField = `${metric}_y`;
    
    // Map metrics to their actual detail field names
    const detailFieldMap = {
      ai: 'ai_conveying',
      pain: 'pain_conveying',
      advice: 'advice_solution',
      narrative: 'narrative_experience',
    };
    const detailField = detailFieldMap[metric];

    const result = await pool.query(
      `SELECT 
        id,
        post_id,
        title,
        author,
        comments,
        ups,
        upvote_ratio,
        created,
        (embedding->>'${xField}')::numeric as x,
        (embedding->>'${yField}')::numeric as y,
        (speech_detail->>'${detailField}') as detail,
        speech_type
      FROM reddit_posts
      WHERE subreddit = $1 
        AND embedding IS NOT NULL
        AND (embedding->>'${xField}')::numeric IS NOT NULL
        AND (embedding->>'${yField}')::numeric IS NOT NULL
      ORDER BY created DESC`,
      [subreddit]
    );

    const points = result.rows.map(row => ({
      id: row.id,
      post_id: row.post_id,
      title: row.title,
      author: row.author,
      x: parseFloat(row.x),
      y: parseFloat(row.y),
      detail: row.detail || '',
      created: row.created,
      speech_type: row.speech_type || [],
      ...(includeMetadata && {
        comments: row.comments || 0,
        ups: row.ups || 0,
        upvote_ratio: row.upvote_ratio != null ? parseFloat(row.upvote_ratio) : null,
      }),
    }));

    res.json({
      status: 'success',
      subreddit,
      metric,
      points,
      count: points.length,
    });
  } catch (error) {
    console.error('Failed to fetch embeddings:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch embeddings',
    });
  }
});

// Get 3D UMAP embeddings for a subreddit (computed on-the-fly from raw vectors)
app.get('/api/embeddings3d/:subreddit', async (req, res) => {
  const { subreddit } = req.params;

  try {
    const result = await pool.query(
      `SELECT post_id, title, author, comments, ups, created, embedding_vector
       FROM reddit_posts
       WHERE subreddit = $1 AND embedding_vector IS NOT NULL
       ORDER BY created DESC`,
      [subreddit]
    );

    if (result.rows.length < 4) {
      return res.json({ status: 'success', points: [], count: 0, message: 'Not enough data for 3D projection' });
    }

    const vectors = result.rows.map(row => {
      if (Array.isArray(row.embedding_vector)) return row.embedding_vector;
      return typeof row.embedding_vector === 'string'
        ? JSON.parse(row.embedding_vector)
        : row.embedding_vector;
    });

    const umap = new UMAP({
      nComponents: 3,
      nNeighbors: Math.min(15, Math.max(3, vectors.length - 1)),
      minDist: 0.1,
      randomState: 42,
    });

    const reduced = umap.fit(vectors);

    const points = result.rows.map((row, idx) => ({
      post_id: row.post_id,
      title: row.title,
      author: row.author,
      comments: row.comments || 0,
      ups: row.ups || 0,
      created: row.created,
      x: reduced[idx][0],
      y: reduced[idx][1],
      z: reduced[idx][2],
    }));

    res.json({ status: 'success', subreddit, points, count: points.length });
  } catch (error) {
    console.error('Failed to compute 3D embeddings:', error);
    res.status(500).json({ error: error.message || 'Failed to compute 3D embeddings' });
  }
});

// Fetch full post details
app.get('/api/post-details/:postId', async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        id,
        post_id,
        title,
        author,
        comments,
        ups,
        upvote_ratio,
        subreddit,
        selftext,
        url,
        created,
        ai_summary,
        speech_type
      FROM reddit_posts
      WHERE post_id = $1`,
      [postId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Post not found',
      });
    }

    const post = result.rows[0];

    res.json({
      status: 'success',
      post: {
        id: post.id,
        post_id: post.post_id,
        title: post.title,
        author: post.author,
        comments: post.comments || 0,
        ups: post.ups || 0,
        upvote_ratio: post.upvote_ratio || 0,
        subreddit: post.subreddit,
        selftext: post.selftext,
        url: post.url,
        created: post.created,
        ai_summary: post.ai_summary,
        speech_type: post.speech_type || [],
      },
    });
  } catch (error) {
    console.error('Failed to fetch post details:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch post details',
    });
  }
});

// Fetch comments for a specific post from Reddit
app.get('/api/comments/:subreddit/:postId', async (req, res) => {
  const { subreddit, postId } = req.params;

  try {
    const token = await getAccessToken();

    const response = await fetch(
      `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?limit=100`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': process.env.REDDIT_USER_AGENT || 'RedEngine/0.0.1',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status}`);
    }

    const data = await response.json();

    // Extract comments from the second element (first is the post, second is comments)
    const commentsData = data[1]?.data?.children || [];

    // Helper function to recursively extract comments
    function extractComments(items, postId, parentId = null, accumulator = []) {
      if (!items || !Array.isArray(items)) return accumulator;

      for (const item of items) {
        if (item.kind === 't1' && item.data) {
          const commentData = item.data;
          accumulator.push({
            comment_id: commentData.id,
            post_id: postId,
            parent_id: commentData.parent_id || parentId,
            author: commentData.author || '[deleted]',
            body: commentData.body || '',
            ups: commentData.ups || 0,
            downs: commentData.downs || 0,
            num_replies: commentData.replies?.data?.children?.length || 0,
            created: new Date(commentData.created_utc * 1000).toISOString(),
          });

          // Recursively extract nested replies
          if (commentData.replies && commentData.replies.data && commentData.replies.data.children) {
            extractComments(commentData.replies.data.children, postId, commentData.id, accumulator);
          }
        }
      }

      return accumulator;
    }

    // Extract all comments including nested ones
    const comments = extractComments(commentsData, postId);

    res.json({
      status: 'success',
      subreddit,
      postId,
      comments,
      count: comments.length,
    });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch comments',
    });
  }
});

// Reddit data collection endpoint
app.post('/api/collect', async (req, res) => {
  const { subreddit, postCount, after } = req.body;

  // Validation
  if (!subreddit || !postCount) {
    return res.status(400).json({
      error: 'Missing required parameters: subreddit, postCount',
    });
  }

  if (postCount < 1 || postCount > 1000) {
    return res.status(400).json({
      error: 'postCount must be between 1 and 1000',
    });
  }

  try {
    const token = await getAccessToken();
    const allPosts = [];
    let cursor = after || null;
    let remainingCount = postCount;

    // Reddit API limit is 100 per request, so we need to loop for larger counts
    while (remainingCount > 0) {
      const limitPerRequest = Math.min(100, remainingCount);
      
      let redditUrl = `https://oauth.reddit.com/r/${subreddit}/new?limit=${limitPerRequest}`;
      if (cursor) {
        redditUrl += `&after=${cursor}`;
      }

      console.log(`Fetching ${limitPerRequest} posts from r/${subreddit}${cursor ? ' (pagination)' : ''}...`);

      const response = await fetch(redditUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': process.env.REDDIT_USER_AGENT || 'RedEngine/0.0.1',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        if (response.status === 404) {
          throw new Error(`Subreddit r/${subreddit} not found`);
        } else if (response.status === 403) {
          throw new Error(`Access denied to r/${subreddit} - it may be private or restricted`);
        }
        throw new Error(`Reddit API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      
      if (!data.data || !data.data.children || data.data.children.length === 0) {
        console.log('No more posts available');
        break;
      }

      // Transform Reddit posts to our format
      const batchPosts = data.data.children.map((item) => {
        const post = item.data;
        return {
          id: post.id,
          title: post.title,
          author: post.author || '[deleted]',
          score: post.score,
          comments: post.num_comments,
          upvoteRatio: post.upvote_ratio || 0.5,
          ups: post.ups || 0,
          selftext: post.selftext || '',
          url: `https://reddit.com${post.permalink}`,
          created: new Date(post.created_utc * 1000).toISOString(),
          subreddit: post.subreddit,
        };
      });

      allPosts.push(...batchPosts);
      remainingCount -= batchPosts.length;
      cursor = data.data.after;

      console.log(`Got ${batchPosts.length} posts, total so far: ${allPosts.length}, remaining: ${remainingCount}`);

      // Stop if no more posts available
      if (!cursor) {
        console.log('Reached end of subreddit');
        break;
      }

      // Small delay between requests to avoid rate limiting
      if (remainingCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    res.json({
      status: 'success',
      subreddit,
      postCount: allPosts.length,
      requestedCount: postCount,
      collectionId: `col_${Date.now()}`,
      posts: allPosts,
      nextCursor: cursor,
      message: `Fetched ${allPosts.length} posts from r/${subreddit}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reddit API Error:', error);

    res.status(400).json({
      error: error.message || 'Failed to fetch from Reddit',
      details: error.message,
    });
  }
});

// Get last comment fetch date for a post
app.get('/api/last-comment-fetch/:subreddit/:postId', async (req, res) => {
  const { postId } = req.params;

  try {
    const result = await pool.query(
      'SELECT MAX(fetched_at) as last_fetch FROM reddit_comments WHERE post_id = $1',
      [postId]
    );

    const lastFetch = result.rows[0]?.last_fetch;

    res.json({
      status: 'success',
      postId,
      lastFetch: lastFetch || null,
      hasComments: lastFetch !== null && lastFetch !== undefined,
    });
  } catch (error) {
    console.error('Error fetching last comment fetch date:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch last comment date',
    });
  }
});

// Batch get last comment fetch dates for multiple posts
app.post('/api/last-comment-fetch-batch', async (req, res) => {
  const { postIds, subreddit } = req.body;

  // Validation
  if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
    return res.status(400).json({
      error: 'Missing required parameter: postIds array',
    });
  }

  try {
    console.log(`Fetching last comment dates for ${postIds.length} posts in r/${subreddit}...`);

    // Get last comment fetch dates for all posts in one query
    const result = await pool.query(
      `SELECT post_id, MAX(fetched_at) as last_fetch 
       FROM reddit_comments 
       WHERE post_id = ANY($1::VARCHAR[])
       GROUP BY post_id`,
      [postIds]
    );

    // Create a map of post_id -> last_fetch
    const dateMap = {};
    result.rows.forEach(row => {
      dateMap[row.post_id] = row.last_fetch;
    });

    console.log(`✓ Fetched comment dates for ${Object.keys(dateMap).length} posts`);

    res.json({
      status: 'success',
      subreddit,
      totalPosts: postIds.length,
      postsWithComments: Object.keys(dateMap).length,
      dates: dateMap,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch fetch error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch comment dates',
    });
  }
});

// Fetch comments for all posts without comments
app.post('/api/fetch-missing-comments/:subreddit', async (req, res) => {
  const { subreddit } = req.params;
  
  try {
    console.log(`Starting batch fetch for r/${subreddit}...`);

    // Get all posts in this subreddit
    const result = await pool.query(`
      SELECT post_id FROM reddit_posts
      WHERE subreddit = $1
      ORDER BY created DESC
    `, [subreddit]);

    const allPosts = result.rows;
    console.log(`Found ${allPosts.length} total posts in r/${subreddit}`);

    let fetchedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const post of allPosts) {
      try {
        // Check if this post already has comments in DB
        const commentCheck = await pool.query(
          'SELECT COUNT(*) as count FROM reddit_comments WHERE post_id = $1',
          [post.post_id]
        );

        const hasComments = parseInt(commentCheck.rows[0].count) > 0;

        if (hasComments) {
          console.log(`⊘ Post ${post.post_id} already has comments, skipping...`);
          skippedCount++;
          continue;
        }

        console.log(`Fetching comments for post ${post.post_id}...`);

        // Fetch comments from Reddit
        const response = await fetch(
          `https://www.reddit.com/r/${subreddit}/comments/${post.post_id}.json?limit=100`,
          { headers: { 'User-Agent': 'RedEngine/0.0.1' } }
        );

        const data = await response.json();

        if (!response.ok || data.kind !== 'Listing') {
          console.error(`Failed to fetch comments for ${post.post_id}`);
          results.push({ postId: post.post_id, status: 'failed' });
          continue;
        }

        // Extract comments
        const commentItems = data.data.children[1]?.data?.children || [];

        function extractComments(items, postId, parentId = null, accumulator = []) {
          if (!items || !Array.isArray(items)) return accumulator;

          for (const item of items) {
            if (item.kind === 't1' && item.data) {
              const commentData = item.data;
              accumulator.push({
                comment_id: commentData.id,
                post_id: postId,
                parent_id: commentData.parent_id || parentId,
                author: commentData.author || '[deleted]',
                body: commentData.body || '',
                ups: commentData.ups || 0,
                downs: commentData.downs || 0,
                num_replies: commentData.replies?.data?.children?.length || 0,
                created: new Date(commentData.created_utc * 1000).toISOString(),
              });

              if (commentData.replies && commentData.replies.data && commentData.replies.data.children) {
                extractComments(commentData.replies.data.children, postId, commentData.id, accumulator);
              }
            }
          }
          return accumulator;
        }

        const comments = extractComments(commentItems, post.post_id);
        console.log(`✓ Extracted ${comments.length} comments for post ${post.post_id}`);

        // Save each comment
        let savedCount = 0;
        for (const comment of comments) {
          try {
            const insertResult = await pool.query(
              `INSERT INTO reddit_comments 
                (comment_id, post_id, parent_id, author, body, ups, downs, num_replies, created)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (comment_id) DO NOTHING`,
              [
                comment.comment_id,
                comment.post_id,
                comment.parent_id,
                comment.author,
                comment.body,
                comment.ups,
                comment.downs,
                comment.num_replies,
                comment.created,
              ]
            );
            if (insertResult.rowCount > 0) savedCount++;
          } catch (error) {
            console.error(`Error saving comment ${comment.comment_id}:`, error.message);
          }
        }

        // Update comments_last_fetched
        await pool.query(
          'UPDATE reddit_posts SET comments_last_fetched = CURRENT_TIMESTAMP WHERE post_id = $1',
          [post.post_id]
        );

        console.log(`✓ Saved ${savedCount}/${comments.length} comments for post ${post.post_id}`);
        results.push({ 
          postId: post.post_id, 
          status: 'success', 
          commentsSaved: savedCount,
          totalComments: comments.length
        });
        fetchedCount++;

      } catch (error) {
        console.error(`Error processing post ${post.post_id}:`, error.message);
        results.push({ postId: post.post_id, status: 'error', error: error.message });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`Done! Fetched: ${fetchedCount}, Skipped: ${skippedCount}`);

    res.json({
      status: 'success',
      subreddit,
      totalPosts: allPosts.length,
      fetchedCount,
      skippedCount,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Batch fetch error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch missing comments',
    });
  }
});

// Save comments to database endpoint
app.post('/api/save-comments', async (req, res) => {
  const { comments } = req.body;

  console.log('Received /api/save-comments request with', comments?.length, 'comments');

  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    console.error('Invalid request: no comments array');
    return res.status(400).json({
      error: 'Missing required parameters: comments array',
    });
  }

  try {
    let savedCount = 0;
    let skippedCount = 0;
    const errors = [];
    const postIds = new Set();

    for (const comment of comments) {
      try {
        const query = `INSERT INTO reddit_comments 
          (comment_id, post_id, parent_id, author, body, ups, downs, num_replies, created)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (comment_id) DO NOTHING`;
        
        const values = [
          comment.comment_id,
          comment.post_id,
          comment.parent_id,
          comment.author,
          comment.body,
          comment.ups,
          comment.downs,
          comment.num_replies,
          comment.created,
        ];

        console.log(`Saving comment ${comment.comment_id} for post ${comment.post_id}`);
        const result = await pool.query(query, values);
        
        if (result.rowCount > 0) {
          savedCount++;
          postIds.add(comment.post_id);
          console.log(`✓ Saved comment ${comment.comment_id}`);
        } else {
          skippedCount++;
          postIds.add(comment.post_id);
          console.log(`⊘ Skipped comment ${comment.comment_id} (already exists)`);
        }
      } catch (error) {
        console.error(`✗ Failed to save comment ${comment.comment_id}:`, error.message);
        errors.push({ commentId: comment.comment_id, error: error.message });
        skippedCount++;
      }
    }

    // Update comments_last_fetched timestamp for affected posts
    if (postIds.size > 0) {
      const postIdArray = Array.from(postIds);
      for (const postId of postIdArray) {
        try {
          await pool.query(
            'UPDATE reddit_posts SET comments_last_fetched = CURRENT_TIMESTAMP WHERE post_id = $1',
            [postId]
          );
          console.log(`✓ Updated comments_last_fetched for post ${postId}`);
        } catch (error) {
          console.error(`Error updating comments_last_fetched for post ${postId}:`, error.message);
        }
      }
    }

    console.log(`Summary: Saved ${savedCount}, Skipped ${skippedCount}, Errors: ${errors.length}`);

    res.json({
      status: 'success',
      message: `Saved ${savedCount} comments to database`,
      savedCount,
      skippedCount,
      totalCount: comments.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database save error:', error);
    res.status(500).json({
      error: error.message || 'Failed to save comments to database',
      details: error.message,
    });
  }
});

// Save posts to database endpoint
app.post('/api/save', async (req, res) => {
  const { posts, subreddit } = req.body;

  // Validation
  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({
      error: 'Missing required parameters: posts array',
    });
  }

  try {
    let savedCount = 0;
    let skippedCount = 0;

    for (const post of posts) {
      try {
        await pool.query(
          `INSERT INTO reddit_posts 
            (post_id, title, author, score, comments, upvote_ratio, ups, selftext, url, created, subreddit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (post_id) DO NOTHING`,
          [
            post.id,
            post.title,
            post.author,
            post.score,
            post.comments,
            post.upvoteRatio,
            post.ups,
            post.selftext,
            post.url,
            post.created,
            post.subreddit,
          ]
        );
        savedCount++;
      } catch (error) {
        console.error(`Failed to save post ${post.id}:`, error.message);
        skippedCount++;
      }
    }

    res.json({
      status: 'success',
      message: `Saved ${savedCount} posts to database`,
      savedCount,
      skippedCount,
      totalCount: posts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database save error:', error);
    res.status(500).json({
      error: error.message || 'Failed to save posts to database',
      details: error.message,
    });
  }
});

// Calibration endpoint - Process posts with OpenAI for speech_type and ai_summary
app.post('/api/calibrate', async (req, res) => {
  const { subreddit } = req.body;

  // Validation
  if (!subreddit) {
    return res.status(400).json({
      error: 'Missing required parameter: subreddit',
    });
  }

  try {
    console.log(`Starting calibration for r/${subreddit}...`);

    // Get all posts from the subreddit that haven't been calibrated yet
    const result = await pool.query(
      `SELECT id, post_id, title, selftext, subreddit FROM reddit_posts 
       WHERE subreddit = $1 AND (speech_type IS NULL OR ai_summary IS NULL)
       ORDER BY created DESC`,
      [subreddit]
    );

    const posts = result.rows;
    console.log(`Found ${posts.length} posts to calibrate in r/${subreddit}`);

    if (posts.length === 0) {
      return res.json({
        status: 'success',
        message: 'All posts have been calibrated',
        calibratedCount: 0,
        totalCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    let calibratedCount = 0;
    const errors = [];
    const results = [];

    // Process posts in batches of 5
    for (let i = 0; i < posts.length; i += 5) {
      const batch = posts.slice(i, i + 5);
      const batchNum = Math.floor(i / 5) + 1;
      const totalBatches = Math.ceil(posts.length / 5);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} posts)...`);

      // Process all 5 posts in parallel
      const batchPromises = batch.map(async (post) => {
        try {
          // Concatenate subreddit name, title, and selftext
          const postContent = `${post.subreddit}\n${post.title}\n${post.selftext}`;

          console.log(`  🔄 Calibrating post ${post.post_id}...`);

          // Run speech_type, ai_summary, and entities/links extraction in parallel
          const [speechTypeResult, summaryResult, extractionResult] = await Promise.allSettled([
            callOpenAI(PROMPTS.SPEECH_TYPE_CLASSIFICATION(postContent)),
            callOpenAI(PROMPTS.AI_SUMMARY(postContent)),
            callOpenAI(PROMPTS.ENTITIES_AND_LINKS_EXTRACTION(postContent)),
          ]);

          const speechTypeResponse = speechTypeResult.status === 'fulfilled' ? speechTypeResult.value : '';
          const summaryResponse = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
          const extractionResponse = extractionResult.status === 'fulfilled' ? extractionResult.value : null;

          if (speechTypeResult.status === 'rejected') console.warn(`  ⚠ Speech type failed:`, speechTypeResult.reason?.message);
          if (summaryResult.status === 'rejected') console.warn(`  ⚠ Summary failed:`, summaryResult.reason?.message);
          if (extractionResult.status === 'rejected') console.warn(`  ⚠ Extraction failed:`, extractionResult.reason?.message);

          // Parse speech_type
          const tags = speechTypeResponse
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => ['pain_conveying', 'advice_solution', 'narrative_experience'].includes(tag));

          console.log(`  ✓ Speech types: ${tags.join(', ') || '(none)'}`);
          if (summaryResponse) console.log(`  ✓ AI summary created (${summaryResponse.length} chars)`);

          // Parse entities/links
          let entities = null;
          let links = null;
          if (extractionResponse) {
            try {
              const extracted = JSON.parse(extractionResponse.trim());
              // Normalize: if model returns objects instead of strings, flatten to strings
              const rawEntities = extracted.entities;
              if (Array.isArray(rawEntities) && rawEntities.length > 0) {
                entities = rawEntities.map(e => typeof e === 'string' ? e : Object.values(e).flat().join(', ')).filter(Boolean);
              } else if (rawEntities && typeof rawEntities === 'object') {
                // Model returned {People: [...], Organizations: [...]} shape
                entities = Object.values(rawEntities).flat().map(String).filter(Boolean);
              }
              links = Array.isArray(extracted.links) && extracted.links.length > 0 ? extracted.links : null;
              console.log(`  ✓ Entities extracted (${entities?.length ?? 0}), links (${links?.length ?? 0})`);
            } catch (e) {
              console.warn(`  ⚠ Failed to parse entities/links JSON:`, e.message);
            }
          }

          // Speech detail depends on tags, so runs after
          let speechDetail = null;
          if (tags.length > 0) {
            const detailResponse = await callOpenAI(PROMPTS.SPEECH_DETAIL(postContent, tags));

            try {
              speechDetail = JSON.parse(detailResponse.trim());
              console.log(`  ✓ Speech detail created`);
            } catch (e) {
              console.warn(`  ⚠ Failed to parse speech_detail JSON:`, e.message);
            }
          }

          // Update the post with calibration results
          await pool.query(
            `UPDATE reddit_posts 
             SET speech_type = $1, ai_summary = $2, speech_detail = $3, entities = $4, links = $5
             WHERE id = $6`,
            [
              tags.length > 0 ? tags : null,
              summaryResponse ? summaryResponse.trim() : null,
              speechDetail ? JSON.stringify(speechDetail) : null,
              entities,
              links ? JSON.stringify(links) : null,
              post.id,
            ]
          );

          console.log(`  ✓ Post ${post.post_id} calibrated successfully`);

          return {
            postId: post.post_id,
            status: 'success',
            speechType: tags,
            summaryLength: summaryResponse.length,
            entitiesCount: entities?.length ?? 0,
          };
        } catch (error) {
          console.error(`  ✗ Failed to calibrate post ${post.post_id}:`, error.message);
          errors.push({ postId: post.post_id, error: error.message });
          return {
            postId: post.post_id,
            status: 'error',
            error: error.message,
          };
        }
      });

      // Wait for all 5 requests to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      calibratedCount += batchResults.filter(r => r.status === 'success').length;

      // Send progress update via response streaming if supported
      console.log(`✓ Batch ${batchNum} complete`);

      console.log(`✓ Batch ${batchNum} complete`);
    }

    console.log(`✓ Calibration complete! Calibrated ${calibratedCount} posts`);

    res.json({
      status: 'success',
      message: `Calibrated ${calibratedCount} posts for r/${subreddit}`,
      subreddit,
      totalPosts: posts.length,
      calibratedCount,
      errors: errors.length > 0 ? errors : undefined,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Calibration error:', error);
    res.status(500).json({
      error: error.message || 'Failed to calibrate posts',
      details: error.message,
    });
  }
});

// Calibrate single post endpoint - Process one post with OpenAI for speech_type and ai_summary
app.post('/api/calibrate-single', async (req, res) => {
  const { postId, subreddit, title, selftext } = req.body;

  // Validation
  if (!postId || !subreddit || !title) {
    return res.status(400).json({
      error: 'Missing required parameters: postId, subreddit, title',
    });
  }

  try {
    console.log(`Starting single post calibration for post ${postId}...`);

    // Concatenate subreddit name, title, and selftext
    const postContent = `${subreddit}\n${title}\n${selftext || ''}`;

    console.log(`🔄 Calibrating post ${postId}...`);

    // Run speech_type, ai_summary, and entities/links extraction in parallel
    const [speechTypeResult, summaryResult, extractionResult] = await Promise.allSettled([
      callOpenAI(PROMPTS.SPEECH_TYPE_CLASSIFICATION(postContent)),
      callOpenAI(PROMPTS.AI_SUMMARY(postContent)),
      callOpenAI(PROMPTS.ENTITIES_AND_LINKS_EXTRACTION(postContent)),
    ]);

    const speechTypeResponse = speechTypeResult.status === 'fulfilled' ? speechTypeResult.value : '';
    const summaryResponse = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const extractionResponse = extractionResult.status === 'fulfilled' ? extractionResult.value : null;

    if (speechTypeResult.status === 'rejected') console.warn(`⚠ Speech type failed:`, speechTypeResult.reason?.message);
    if (summaryResult.status === 'rejected') console.warn(`⚠ Summary failed:`, summaryResult.reason?.message);
    if (extractionResult.status === 'rejected') console.warn(`⚠ Extraction failed:`, extractionResult.reason?.message);

    // Parse speech_type
    const tags = speechTypeResponse
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => ['pain_conveying', 'advice_solution', 'narrative_experience'].includes(tag));

    console.log(`✓ Speech types: ${tags.join(', ') || '(none)'}`);
    if (summaryResponse) console.log(`✓ AI summary created (${summaryResponse.length} chars)`);

    // Parse entities/links
    let entities = null;
    let links = null;
    if (extractionResponse) {
      try {
        const extracted = JSON.parse(extractionResponse.trim());
        // Normalize: if model returns objects instead of strings, flatten to strings
        const rawEntities = extracted.entities;
        if (Array.isArray(rawEntities) && rawEntities.length > 0) {
          entities = rawEntities.map(e => typeof e === 'string' ? e : Object.values(e).flat().join(', ')).filter(Boolean);
        } else if (rawEntities && typeof rawEntities === 'object') {
          // Model returned {People: [...], Organizations: [...]} shape
          entities = Object.values(rawEntities).flat().map(String).filter(Boolean);
        }
        links = Array.isArray(extracted.links) && extracted.links.length > 0 ? extracted.links : null;
        console.log(`✓ Entities extracted (${entities?.length ?? 0}), links (${links?.length ?? 0})`);
      } catch (e) {
        console.warn(`⚠ Failed to parse entities/links JSON:`, e.message);
      }
    }

    // Speech detail depends on tags, so runs after
    let speechDetail = null;
    if (tags.length > 0) {
      const detailResponse = await callOpenAI(PROMPTS.SPEECH_DETAIL(postContent, tags));

      try {
        speechDetail = JSON.parse(detailResponse.trim());
        console.log(`✓ Speech detail created`);
      } catch (e) {
        console.warn(`⚠ Failed to parse speech_detail JSON:`, e.message);
      }
    }

    // Update the post with calibration results
    await pool.query(
      `UPDATE reddit_posts 
       SET speech_type = $1, ai_summary = $2, speech_detail = $3, entities = $4, links = $5
       WHERE post_id = $6`,
      [
        tags.length > 0 ? tags : null,
        summaryResponse ? summaryResponse.trim() : null,
        speechDetail ? JSON.stringify(speechDetail) : null,
        entities,
        links ? JSON.stringify(links) : null,
        postId,
      ]
    );

    console.log(`✓ Post ${postId} calibrated successfully`);

    res.json({
      status: 'success',
      message: `Post ${postId} calibrated successfully`,
      postId,
      speechType: tags,
      summary: summaryResponse.trim(),
      speechDetail,
      entities,
      links,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Single post calibration error:', error);
    res.status(500).json({
      error: error.message || 'Failed to calibrate post',
      details: error.message,
    });
  }
});

// Fetch speech detail for a single post
app.post('/api/fetch-speech-detail', async (req, res) => {
  const { postId, subreddit, title, selftext, speechType } = req.body;

  if (!postId || !title || !speechType || !Array.isArray(speechType)) {
    return res.status(400).json({
      error: 'Missing required parameters: postId, title, speechType (array)',
    });
  }

  try {
    console.log(`🔄 Generating speech detail for post ${postId}...`);

    // Concatenate post content
    const postContent = `${subreddit || ''}\n${title}\n${selftext || ''}`;

    // Only generate speech_detail if there are tags
    let speechDetail = null;
    if (speechType.length > 0) {
      const detailResponse = await callOpenAI(PROMPTS.SPEECH_DETAIL(postContent, speechType));

      try {
        speechDetail = JSON.parse(detailResponse.trim());
        console.log(`✓ Speech detail created`);
      } catch (e) {
        console.warn(`⚠ Failed to parse speech_detail JSON:`, e.message);
        console.warn(`Raw response:`, detailResponse);
        speechDetail = null;
      }
    }

    // Update the post with speech_detail in the database
    const updateResult = await pool.query(
      `UPDATE reddit_posts 
       SET speech_detail = $1
       WHERE post_id = $2
       RETURNING id`,
      [
        speechDetail ? JSON.stringify(speechDetail) : null,
        postId,
      ]
    );

    if (updateResult.rowCount === 0) {
      console.warn(`⚠ No post found with post_id: ${postId}`);
    } else {
      console.log(`✓ Speech detail saved to database for post ${postId}`);
    }

    res.json({
      status: 'success',
      message: `Speech detail generated and saved for post ${postId}`,
      postId,
      speechDetail,
    });

  } catch (error) {
    console.error('Fetch speech detail error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch speech detail',
      details: error.message,
    });
  }
});

// Embed posts using OpenAI embeddings and UMAP
app.post('/api/embed-posts', async (req, res) => {
  const { subreddit } = req.body;

  if (!subreddit) {
    return res.status(400).json({
      error: 'Missing required parameter: subreddit',
    });
  }

  try {
    console.log(`🔄 Starting embedding for subreddit: ${subreddit}...`);

    // Fetch all posts from the subreddit
    const postsResult = await pool.query(
      `SELECT id, post_id, title, ai_summary, speech_detail, speech_type
       FROM reddit_posts
       WHERE subreddit = $1 AND ai_summary IS NOT NULL
       ORDER BY created DESC`,
      [subreddit]
    );

    const posts = postsResult.rows;

    if (posts.length === 0) {
      return res.status(400).json({
        error: `No posts with ai_summary found for subreddit: ${subreddit}`,
      });
    }

    console.log(`✓ Found ${posts.length} posts to embed`);

    // Collect all texts to embed
    const textsToEmbed = [];
    const textMetadata = []; // Track which post and field each text belongs to

    posts.forEach(post => {
      // Always embed ai_summary if it exists and is not empty
      if (post.ai_summary && typeof post.ai_summary === 'string' && post.ai_summary.trim()) {
        textsToEmbed.push(post.ai_summary);
        textMetadata.push({
          postId: post.post_id,
          field: 'ai',
          dbId: post.id,
        });
      }

      // Embed speech_detail fields if they exist
      if (post.speech_detail && post.speech_type && Array.isArray(post.speech_type)) {
        const details = post.speech_detail;

        post.speech_type.forEach(tag => {
          let fieldName = null;
          let textToEmbed = null;

          if (tag === 'pain_conveying' && details.pain_conveying) {
            fieldName = 'pain';
            textToEmbed = details.pain_conveying;
          } else if (tag === 'advice_solution' && details.advice_solution) {
            fieldName = 'advice';
            textToEmbed = details.advice_solution;
          } else if (tag === 'narrative_experience' && details.narrative_experience) {
            fieldName = 'narrative';
            textToEmbed = details.narrative_experience;
          }

          if (fieldName && textToEmbed && typeof textToEmbed === 'string' && textToEmbed.trim()) {
            textsToEmbed.push(textToEmbed);
            textMetadata.push({
              postId: post.post_id,
              field: fieldName,
              dbId: post.id,
            });
          }
        });
      }
    });

    console.log(`✓ Prepared ${textsToEmbed.length} texts to embed`);

    // Call OpenAI embeddings API in batches
    const embeddings = [];
    const batchSize = 50; // OpenAI allows up to 2048 texts per request
    
    for (let i = 0; i < textsToEmbed.length; i += batchSize) {
      const batch = textsToEmbed.slice(i, Math.min(i + batchSize, textsToEmbed.length));
      console.log(`📊 Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(textsToEmbed.length / batchSize)}...`);

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: batch,
          dimensions: 256,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI Embeddings API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      embeddings.push(...data.data);

      // Small delay between batches
      if (i + batchSize < textsToEmbed.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`✓ Received ${embeddings.length} embeddings from OpenAI`);

    // Extract embedding vectors
    const vectors = embeddings.map((e, idx) => {
      const vec = e.embedding;
      // Verify it's a valid vector
      if (!Array.isArray(vec) || vec.length !== 256) {
        throw new Error(`Invalid embedding vector at index ${idx}. Expected 256D, got ${vec.length}D`);
      }
      return vec;
    });

    console.log(`✓ Extracted vectors, starting UMAP reduction...`);

    // Group vectors by field for separate UMAP reduction
    const vectorsByField = {
      ai: [],
      pain: [],
      advice: [],
      narrative: [],
    };

    const metadataByField = {
      ai: [],
      pain: [],
      advice: [],
      narrative: [],
    };

    // Organize vectors and metadata by field
    textMetadata.forEach((meta, idx) => {
      const field = meta.field;
      vectorsByField[field].push(vectors[idx]);
      metadataByField[field].push(meta);
    });

    // Initialize post embeddings
    const postEmbeddings = {};

    posts.forEach(post => {
      postEmbeddings[post.id] = {
        ai_x: null,
        ai_y: null,
        pain_x: null,
        pain_y: null,
        advice_x: null,
        advice_y: null,
        narrative_x: null,
        narrative_y: null,
      };
    });

    // Apply separate UMAP to each field
    const fields = ['ai', 'pain', 'advice', 'narrative'];
    for (const field of fields) {
      if (vectorsByField[field].length === 0) continue;
      
      console.log(`  Reducing ${field} metric (${vectorsByField[field].length} vectors)...`);
      
      const umap = new UMAP({
        nComponents: 2,
        nNeighbors: Math.min(15, Math.max(3, vectorsByField[field].length - 1)),
        minDist: 0.1,
        randomState: 42,
      });
      
      const reduced = umap.fit(vectorsByField[field]);
      
      // Map coordinates back to posts
      reduced.forEach((coords, idx) => {
        const meta = metadataByField[field][idx];
        const dbId = meta.dbId;
        
        if (postEmbeddings[dbId]) {
          postEmbeddings[dbId][`${field}_x`] = coords[0];
          postEmbeddings[dbId][`${field}_y`] = coords[1];
        }
      });
    }

    console.log(`✓ UMAP reduction complete for all metrics...`);

    // Store only the AI embedding vector (what semantic search uses)
    const postVectors = {};
    posts.forEach(post => {
      postVectors[post.id] = null;
    });

    // Store the AI embedding vector from OpenAI
    vectors.forEach((vec, idx) => {
      const meta = textMetadata[idx];
      const dbId = meta.dbId;
      const field = meta.field;

      // Only store the 'ai' vector since that's what semantic search uses
      if (field === 'ai' && postVectors.hasOwnProperty(dbId)) {
        postVectors[dbId] = vec;
      }
    });

    // Update database with embeddings
    let successCount = 0;
    for (const [dbId, embedding] of Object.entries(postEmbeddings)) {
      await pool.query(
        `UPDATE reddit_posts 
         SET embedding = $1, embedding_vector = $2
         WHERE id = $3`,
        [JSON.stringify(embedding), postVectors[dbId] ? postVectors[dbId] : null, dbId]
      );
      successCount++;
    }

    console.log(`✓ Embeddings saved for ${successCount} posts`);

    res.json({
      status: 'success',
      message: `Embedded ${successCount} posts for subreddit: ${subreddit}`,
      subreddit,
      postsEmbedded: successCount,
      textsProcessed: textsToEmbed.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Embedding error:', error);
    res.status(500).json({
      error: error.message || 'Failed to embed posts',
      details: error.message,
    });
  }
});

// Call OpenAI API (with retry)
async function callOpenAI(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const status = response.status;
        // Retry on rate limit (429) or server errors (5xx)
        if ((status === 429 || status >= 500) && attempt < retries) {
          const delay = attempt * 1000;
          console.warn(`OpenAI ${status} error, retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`OpenAI API error: ${status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content?.trim();

      if (!content) {
        if (attempt < retries) {
          const delay = attempt * 1000;
          console.warn(`Empty response from OpenAI, retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw new Error('Empty response from OpenAI after all retries');
      }

      return content;
    } catch (error) {
      if (attempt < retries && (error.message.includes('fetch') || error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT'))) {
        const delay = attempt * 1000;
        console.warn(`Network error, retrying in ${delay}ms (attempt ${attempt}/${retries}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (attempt === retries) {
        console.error('OpenAI API call failed:', error.message);
        throw error;
      }
    }
  }
}

// Name clusters endpoint - Generate AI-based names for clusters
app.post('/api/name-clusters', async (req, res) => {
  const { clusters } = req.body;

  if (!clusters || typeof clusters !== 'object' || Object.keys(clusters).length === 0) {
    return res.status(400).json({
      error: 'Missing required parameter: clusters object',
    });
  }

  try {
    console.log(`🔄 Generating names AND overviews for ${Object.keys(clusters).length} clusters...`);

    const names = {};
    const overviews = {};

    // Process each cluster
    for (const [clusterKey, clusterData] of Object.entries(clusters)) {
      try {
        const { posts, postCount } = clusterData;

        if (!Array.isArray(posts) || posts.length === 0) {
          console.warn(`⚠ Cluster ${clusterKey} has no posts, skipping...`);
          continue;
        }

        // Prepare cluster summary for AI
        const postSummary = posts
          .slice(0, 5) // Use first 5 posts for context
          .map(p => `Title: ${p.title}\nContent: ${p.content}`)
          .join('\n\n');

        // Generate cluster name
        const namePrompt = `Based on the following posts from a cluster (showing the most relevant posts), generate a SHORT and CONCISE cluster name (2-4 words maximum) that describes the main theme or topic of this group. The name should be specific and descriptive.

Posts in cluster (${postCount} total):
${postSummary}

Respond with ONLY the cluster name, nothing else. No quotes, no explanation.`;

        console.log(`  🔄 Processing cluster ${clusterKey}...`);
        const clusterName = await callOpenAI(namePrompt);
        const cleanName = clusterName.replace(/^["']|["']$/g, '').trim();
        names[clusterKey] = cleanName;

        // Generate overview using the generated cluster name
        const overviewSummary = posts
          .slice(0, 10)
          .map((p, idx) => `Post ${idx + 1}: ${p.title}\nContent: ${p.content || 'N/A'}\nEngagement: ${p.upvotes} upvotes, ${p.comments} comments`)
          .join('\n\n');

        const overviewPrompt = `Based on the following posts from a group called "${cleanName}" (showing the top posts by relevance), generate a concise paragraph (3-5 sentences) that describes the main themes, common topics, and overall sentiment of this group. Focus on what unites these posts and what makes this group unique.

Group: "${cleanName}" (${postCount} posts total)
Top Posts:
${overviewSummary}

Respond with ONLY the paragraph, no additional text or explanation.`;

        const overview = await callOpenAI(overviewPrompt);
        overviews[clusterKey] = overview;

        console.log(`  ✓ Cluster ${clusterKey}: "${cleanName}" (overview generated)`);
      } catch (error) {
        console.error(`  ✗ Failed to process cluster ${clusterKey}:`, error.message);
        names[clusterKey] = `Cluster ${clusterKey.replace('cluster_', '')}`;
        overviews[clusterKey] = 'Overview generation failed.';
      }
    }

    console.log(`✓ Cluster processing complete! Generated ${Object.keys(names).length} names and overviews`);

    res.json({
      status: 'success',
      message: `Generated names and overviews for ${Object.keys(names).length} clusters`,
      names,
      overviews,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cluster naming error:', error);
    res.status(500).json({
      error: error.message || 'Failed to name clusters',
      details: error.message,
    });
  }
});

// Generate group overview
app.post('/api/group-overview', async (req, res) => {
  const { groupName, posts, postCount } = req.body;

  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({
      error: 'Missing required parameter: posts array',
    });
  }

  try {
    console.log(`🔄 Generating overview for group "${groupName}" with ${postCount} posts...`);

    // Prepare cluster summary for AI
    const postSummary = posts
      .slice(0, 10) // Use first 10 posts for context
      .map((p, idx) => `Post ${idx + 1}: ${p.title}\nContent: ${p.content || 'N/A'}\nEngagement: ${p.upvotes} upvotes, ${p.comments} comments`)
      .join('\n\n');

    const prompt = `Based on the following posts from a group called "${groupName}" (showing the top posts by relevance), generate a concise paragraph (3-5 sentences) that describes the main themes, common topics, and overall sentiment of this group. Focus on what unites these posts and what makes this group unique.

Group: "${groupName}" (${postCount} posts total)
Top Posts:
${postSummary}

Respond with ONLY the paragraph, no additional text or explanation.`;

    console.log(`  🔄 Generating overview for "${groupName}"...`);
    const overview = await callOpenAI(prompt);

    console.log(`✓ Overview generated for "${groupName}"`);

    res.json({
      status: 'success',
      overview: overview.trim(),
      groupName,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Group overview generation error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate group overview',
      details: error.message,
    });
  }
});

// Exact search endpoint
app.post('/api/search/exact', async (req, res) => {
  try {
    const { subreddit, query } = req.body;

    if (!subreddit || !query) {
      return res.status(400).json({
        error: 'Missing required parameters: subreddit and query',
      });
    }

    const queryTermLower = query.toLowerCase().trim();
    
    // Query the database for posts matching the exact term in any of the specified fields
    const searchQuery = `
      SELECT 
        post_id,
        title,
        author,
        ups,
        comments,
        created,
        subreddit
      FROM reddit_posts
      WHERE subreddit = $1
        AND (
          LOWER(title) LIKE $2
          OR LOWER(COALESCE(selftext, '')) LIKE $2
          OR LOWER(COALESCE(speech_detail::text, '')) LIKE $2
          OR LOWER(COALESCE(ai_summary, '')) LIKE $2
        )
      ORDER BY ups DESC, comments DESC
      LIMIT 100
    `;

    const result = await pool.query(searchQuery, [subreddit, `%${queryTermLower}%`]);

    // Format the results
    const posts = result.rows.map(row => ({
      post_id: row.post_id,
      title: row.title,
      author: row.author,
      ups: row.ups,
      comments: row.comments,
      created: row.created,
      subreddit: row.subreddit,
    }));

    res.json({
      status: 'success',
      posts,
      count: posts.length,
      query: queryTermLower,
      subreddit,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Exact search error:', error);
    res.status(500).json({
      error: error.message || 'Failed to perform search',
      details: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Semantic search endpoint
app.post('/api/search/semantic', async (req, res) => {
  try {
    const { subreddit, query, metric = 'ai' } = req.body;

    if (!subreddit || !query) {
      return res.status(400).json({
        error: 'Missing required parameters: subreddit and query',
      });
    }

    // Validate metric
    const validMetrics = ['ai', 'pain', 'advice', 'narrative'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`,
      });
    }

    console.log(`🔄 Starting semantic search for "${query}" in r/${subreddit}...`);

    // Step 1: Embed the query
    const queryEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 256,
      }),
    });

    if (!queryEmbeddingResponse.ok) {
      const errorData = await queryEmbeddingResponse.json();
      throw new Error(`OpenAI Embeddings API error: ${queryEmbeddingResponse.status}`);
    }

    const queryEmbeddingData = await queryEmbeddingResponse.json();
    const queryEmbedding = queryEmbeddingData.data[0].embedding;

    console.log(`✓ Query embedded (256D vector)`);

    // Step 2: Fetch ALL posts with embeddings for the subreddit
    const postsResult = await pool.query(
      `SELECT 
        post_id,
        title,
        author,
        ups,
        comments,
        embedding_vector
      FROM reddit_posts
      WHERE subreddit = $1 AND embedding_vector IS NOT NULL
      ORDER BY post_id ASC`,
      [subreddit]
    );

    if (postsResult.rows.length === 0) {
      return res.status(400).json({
        error: `No posts with embedding vectors found for subreddit: ${subreddit}. Please run embedding first.`,
      });
    }

    console.log(`✓ Loaded ${postsResult.rows.length} posts with 256D vectors`);

    // Step 3: Parse vectors from database
    const postVectors = [];
    postsResult.rows.forEach((row) => {
      let vector = row.embedding_vector;
      
      // Parse embedding_vector if stored as JSON string
      if (vector) {
        if (typeof vector === 'string') {
          try {
            vector = JSON.parse(vector);
          } catch (e) {
            console.warn(`Failed to parse embedding_vector for post ${row.post_id}`);
            return; // Skip this post
          }
        }
        
        if (Array.isArray(vector) && vector.length === 256) {
          postVectors.push({
            post_id: row.post_id,
            title: row.title,
            author: row.author,
            ups: row.ups,
            comments: row.comments,
            vector: vector,
          });
        }
      }
    });

    if (postVectors.length === 0) {
      return res.status(400).json({
        error: `No posts with valid 256D vectors found for subreddit: ${subreddit}`,
      });
    }

    console.log(`✓ Parsed ${postVectors.length} posts with 256D vectors`);

    // Step 4: Helper function for cosine similarity
    const cosineSimilarity = (a, b) => {
      let dotProduct = 0;
      let magnitudeA = 0;
      let magnitudeB = 0;
      
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
      }
      
      magnitudeA = Math.sqrt(magnitudeA);
      magnitudeB = Math.sqrt(magnitudeB);
      
      if (magnitudeA === 0 || magnitudeB === 0) return 0;
      return dotProduct / (magnitudeA * magnitudeB);
    };

    // Step 5: Calculate cosine similarity between query and all posts
    const similarities = postVectors.map((post) => {
      const similarity = cosineSimilarity(queryEmbedding, post.vector);
      
      return {
        post_id: post.post_id,
        title: post.title,
        author: post.author,
        ups: post.ups,
        comments: post.comments,
        similarity: similarity,
      };
    });

    // Sort by similarity (highest first) - return all results
    const topResults = similarities
      .sort((a, b) => b.similarity - a.similarity);

    console.log(`✓ Found ${topResults.length} most similar posts`);

    res.json({
      status: 'success',
      posts: topResults.map(r => ({
        post_id: r.post_id,
        title: r.title,
        author: r.author,
        ups: r.ups,
        comments: r.comments,
        similarity_score: r.similarity.toFixed(3),
      })),
      count: topResults.length,
      query,
      subreddit,
      metric,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({
      error: error.message || 'Failed to perform semantic search',
      details: error.message,
    });
  }
});

// Approximate location endpoint - estimates query position from nearest neighbors
app.post('/api/search/approximate-location', async (req, res) => {
  try {
    const { subreddit, query, metric = 'ai' } = req.body;

    if (!subreddit || !query) {
      return res.status(400).json({
        error: 'Missing required parameters: subreddit and query',
      });
    }

    console.log(`📍 Computing approximate location for "${query}" in r/${subreddit}...`);

    // Step 1: Embed the query
    const queryEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 256,
      }),
    });

    if (!queryEmbeddingResponse.ok) {
      throw new Error(`OpenAI Embeddings API error: ${queryEmbeddingResponse.status}`);
    }

    const queryEmbeddingData = await queryEmbeddingResponse.json();
    const queryEmbedding = queryEmbeddingData.data[0].embedding;

    console.log(`✓ Query embedded (256D vector)`);

    // Step 2: Fetch all posts with embeddings including their 2D coordinates
    const xField = `${metric}_x`;
    const yField = `${metric}_y`;

    const postsResult = await pool.query(
      `SELECT 
        post_id,
        embedding_vector,
        (embedding->>'${xField}')::numeric as x,
        (embedding->>'${yField}')::numeric as y
      FROM reddit_posts
      WHERE subreddit = $1 AND embedding_vector IS NOT NULL
        AND (embedding->>'${xField}')::numeric IS NOT NULL
        AND (embedding->>'${yField}')::numeric IS NOT NULL
      ORDER BY post_id ASC`,
      [subreddit]
    );

    if (postsResult.rows.length === 0) {
      return res.status(400).json({
        error: `No posts found for subreddit: ${subreddit}`,
      });
    }

    console.log(`✓ Loaded ${postsResult.rows.length} posts with embeddings`);

    // Step 3: Parse vectors and calculate similarities
    const cossineSimilarity = (a, b) => {
      let dotProduct = 0;
      let magnitudeA = 0;
      let magnitudeB = 0;
      
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
      }
      
      magnitudeA = Math.sqrt(magnitudeA);
      magnitudeB = Math.sqrt(magnitudeB);
      
      if (magnitudeA === 0 || magnitudeB === 0) return 0;
      return dotProduct / (magnitudeA * magnitudeB);
    };

    const similarities = [];
    postsResult.rows.forEach((row) => {
      let vector = row.embedding_vector;
      
      // Parse embedding_vector if stored as JSON string
      if (vector) {
        if (typeof vector === 'string') {
          try {
            vector = JSON.parse(vector);
          } catch (e) {
            return; // Skip this post
          }
        }
        
        if (Array.isArray(vector) && vector.length === 256) {
          const similarity = cossineSimilarity(queryEmbedding, vector);
          similarities.push({
            post_id: row.post_id,
            similarity: similarity,
            x: parseFloat(row.x),
            y: parseFloat(row.y),
          });
        }
      }
    });

    if (similarities.length === 0) {
      return res.status(400).json({
        error: `No valid posts found for calculating position`,
      });
    }

    // Step 4: Find top K nearest neighbors by cosine similarity
    const K = Math.min(3, similarities.length);
    const sorted = similarities.sort((a, b) => b.similarity - a.similarity);
    const topNeighbors = sorted.slice(0, K);

    console.log(`✓ Found top ${K} nearest neighbors`);

    // Step 5: Estimate query position as average of nearest neighbors
    let totalX = 0, totalY = 0;
    topNeighbors.forEach(neighbor => {
      totalX += neighbor.x;
      totalY += neighbor.y;
    });

    const estimatedX = totalX / K;
    const estimatedY = totalY / K;

    console.log(`✓ Estimated location: [${estimatedX.toFixed(2)}, ${estimatedY.toFixed(2)}]`);

    res.json({
      status: 'success',
      queryPosition: {
        x: estimatedX,
        y: estimatedY,
      },
      query,
      subreddit,
      metric,
      nearestNeighbors: K,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Approximate location error:', error);
    res.status(500).json({
      error: error.message || 'Failed to compute approximate location',
      details: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = app.listen(PORT, () => {
  console.log(`RedEngine backend running on port ${PORT}`);
  console.log('Reddit API initialized with OAuth2 Client Credentials flow');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    await pool.end();
    console.log('Database pool closed');
    process.exit(0);
  });
});
