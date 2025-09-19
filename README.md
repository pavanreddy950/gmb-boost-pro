# LOBAISEO

LOBAISEO is a professional Google Business Profile management platform that helps you schedule posts, manage reviews, and boost your online presence.

## Features

- Google Business Profile connection and management
- Post scheduling and publishing
- Review management and response automation
- Business profile analytics
- QR code generation for customer reviews

## Development Setup

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..

# Start the development servers
npm run dev        # Frontend (port 3000)
cd server && npm run dev  # Backend (port 5000)
```

## Technologies Used

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express
- **Authentication**: Firebase Auth
- **APIs**: Google Business Profile API, Google My Business API

## Project Structure

```
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utility libraries
│   └── pages/             # Page components
├── server/                # Backend source code
├── public/                # Static assets
└── docs/                  # Documentation
```

## Configuration

1. Set up Firebase authentication
2. Configure Google Business Profile API credentials
3. Update environment variables in `.env.local` and `server/.env`

For detailed setup instructions, see the CLAUDE.md file.