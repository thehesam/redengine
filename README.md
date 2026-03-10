# RedEngine

A full-stack dark analytical engine with **Next.js SSR frontend** and **Express.js backend** for collecting and analyzing Reddit data.

## Project Structure

```
RedEngine v0.0
├── frontend/      # Next.js + React
│   ├── src/
│   │   ├── app/              # Pages and layouts
│   │   │   ├── page.tsx         # Home page
│   │   │   └── collecting/      # Data collection route
│   │   ├── components/       # UI components
│   │   ├── constants/        # Design system
│   │   └── styles/           # Global CSS
│   └── package.json
│
└── backend/       # Express.js
    ├── src/
    │   └── index.js          # API server
    └── package.json
```

## Features

### Frontend
- **Landing Page** (`/`): Main entry point with "Start Collecting" button
- **Collection Page** (`/collecting`): Form to configure Reddit data collection
  - Input subreddit name
  - Specify number of posts (1-1000)
  - Connected to backend API
- **Components Showcase** (`/components`): Design system components demo

### Backend
- RESTful API for data collection
- `/api/collect` - POST endpoint to start collecting Reddit data
- `/api/health` - Health check
- `/api/status` - Engine status

## Getting Started

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:3000

### Backend (Express)

```bash
cd backend
npm install
npm run dev
```

API runs on http://localhost:5000

## Configuration

### Backend Environment

Create `backend/.env`:

```
PORT=5000
NODE_ENV=development
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=RedEngine/0.0.1 by your_username
REDDIT_REDIRECT_URI=http://localhost:8080
```

### Frontend Environment

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Design System

### Colors
- **Background**: `#0B0B0F`
- **Surface**: `#18181F`
- **Border**: `#2A2A33`
- **Accent (Red)**: `#FF3B3B`
- **Text Primary**: `#E6E6EB`
- **Text Secondary**: `#A1A1AA`
- **Success**: `#22C55E`
- **Warning**: `#F59E0B`

### Typography
- **Primary**: Inter
- **Mono**: JetBrains Mono
- **Type Scale**: H1 (32px), H2 (24px), H3 (18px), Body (15px), Small (13px)

### Components
- `Button` - Primary/Secondary variants, 3 sizes
- `Card` - Surface containers with borders
- `Badge` - Status indicators

## How to Collect Data

1. Open http://localhost:3000
2. Click "Start Collecting"
3. Enter a subreddit name (e.g., "programming")
4. Set number of posts to collect (1-1000)
5. Click "Start Collection"
6. Backend will begin collecting data from Reddit API

## Development

The design system is fully implemented with Tailwind CSS. All components use the RedEngine color palette and spacing system configured in `tailwind.config.js`.
