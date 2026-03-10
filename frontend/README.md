# RedEngine Frontend

Next.js frontend application with dark RedEngine design system.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view.

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Pages

- `/` - Main landing page with "Start Collecting" button
- `/collecting` - Reddit data collection form
- `/components` - Design system component showcase

## Design System

- **Colors**: Dark mode with red accents
- **Typography**: Inter + JetBrains Mono
- **Components**: Button, Card, Badge
- **Spacing**: 8px based grid
- **Radius**: 10-14px

## Project Structure

```
src/
├── app/           # Next.js app directory
│   ├── page.tsx         # Home page
│   ├── layout.tsx       # Root layout
│   ├── components/      # Components showcase
│   └── collecting/      # Data collection route
├── components/    # React components
├── styles/        # Global styles
└── constants/     # Design system constants
```
