# RedEngine Backend

Express.js backend server for RedEngine data collection.

## Getting Started

```bash
npm install
npm run dev
```

Server runs on port 5000 by default.

## Available Endpoints

- `GET /api/health` - Health check
- `GET /api/status` - Engine status
- `POST /api/collect` - Start collecting data from Reddit

## Environment Variables

Create a `.env` file with the following:

```
PORT=5000
NODE_ENV=development
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=RedEngine/0.0.1 by your_username
REDDIT_REDIRECT_URI=http://localhost:8080
```

## API Documentation

### POST /api/collect

Start collecting data from a Reddit subreddit.

**Request:**
```json
{
  "subreddit": "programming",
  "postCount": 100
}
```

**Response:**
```json
{
  "status": "collection_started",
  "subreddit": "programming",
  "postCount": 100,
  "collectionId": "col_1234567890",
  "message": "Started collecting 100 posts from r/programming",
  "timestamp": "2026-03-05T12:00:00Z"
}
```
