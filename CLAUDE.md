# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📱 Overview

This is a wallpaper app consisting of:
- **Frontend**: React Native Expo app (Android) using Expo Router for file-based routing
- **Backend**: Cloudflare Worker API (Hono) with D1 SQL database and R2 object storage
- **Image Processing**: AWS Rekognition for automatic tagging/categorization of wallpapers
- **Workflow**: Manual download → Upload script → Tagging → API serves to app

## 🛠️ Common Development Commands

### Frontend (Expo App)
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android emulator/device
npm run android

# Run on iOS simulator (macOS only)
npm run ios

# Run in web browser
npm run web

# Lint JavaScript/TypeScript
npm run lint

# Reset project to clean state (removes app/ directory, keeps app-example/)
npm run reset-project
```

### Backend (Cloudflare Worker)
```bash
# Install backend dependencies (in wallepi-backend/)
cd wallepi-backend
npm install

# Start local development server
npm run dev

# Deploy to Cloudflare
npm run deploy

# Initialize database (run schema.sql)
npm run db:init

# Run upload script (local folder to R2)
npm run upload -- "<path-to-local-wallpapers>"

# Run image tagging script (uses AWS Rekognition)
npm run tag

# Convert JSONL to CSV (for analytics)
npm run jsonl-to-csv

# Remove duplicate wallpapers
npm run deduplicate
```

## 🏗️ Project Structure

### Frontend (`/src`)
```
src/
├── app/                # Expo Router pages (file-based routing)
│   ├── _layout.tsx     # Root layout (provider, theme, status bar)
│   ├── index.tsx       # Home screen: Wallpaper of the Day + grid + shuffle FAB
│   └── wallpaper/      # Dynamic route for wallpaper preview
│       └── [id].tsx    # Full-screen viewer with download/set-as-wallpaper
├── components/         # Reusable UI components
│   ├── WallpaperGrid.tsx       # Masonry grid with FlatList
│   ├── WallpaperCard.tsx       # Single thumbnail with press handler
│   ├── HeroCard.tsx       ├── ShuffleFAB.tsx          # Floating action button for random wallpaper
│   ├── DownloadButton.tsx      # Animated download with progress
│   └── SetWallpaperSheet.tsx   # Bottom sheet for wallpaper target selection
├── services/           # Service layer
│   ├── api.ts          # Typed fetch wrapper for backend API
│   ├── mockData.ts     # Mock wallpaper data for offline development
│   └── wallpaperManager.ts     # Native wallpaper setting (Android)
├── hooks/              # Custom React hooks
│   └── useWallpapers.ts    # Paginated wallpaper fetching hook
├── lib/                # Utilities
│   ├── cacheManager.ts # AsyncLRU cache for API responses
│   └── favoritesStore.ts   # AsyncStorage wrapper for favorites
├── constants/          # Constants and design tokens
│   ├── theme.ts        # Colors, spacing, typography (dark/light)
│   └── api.ts          # API base URL configuration
└── types/              # TypeScript type declarations
    └── declarations.d.ts
```

### Backend (`/wallepi-backend`)
```
wallepi-backend/
├── src/
│   ├── index.ts        # Main entry: Hono app (API only - no sync cron)
│   ├── categorize.ts   # AWS Rekognition image tagging
│   └── types.ts        # Shared TypeScript types
├── sync/               # Empty - sync functionality removed
├── scripts/            # Utility scripts
│   ├── upload.ts       # Local folder → R2 uploader (manual workflow)
│   ├── jsonl-to-csv.ts # Convert JSONL labels to CSV
│   ├── deduplicate.ts  # Remove duplicate wallpapers
│   └── image-tagging.ts # AWS Rekognition tagging
├── schema.sql          # D1 database schema
├── wrangler.toml       # Cloudflare Worker configuration (API only)
└── .env.local          # Environment variables (AWS credentials, not committed)
```

## 🔧 Development Workflow

### Current Workflow (Manual Upload)
1. **Download wallpapers**: Get images from Google Photos/local storage
2. **Upload to R2/D1**: Run upload script to process images
   ```bash
   cd wallepi-backend
   npm run upload -- "/path/to/wallpapers"
   ```
3. **Tag images**: Run Rekognition for categorization
   ```bash
   npm run tag
   ```
4. **Convert formats** (optional): Generate CSV for analysis
   ```bash
   npm run jsonl-to-csv
   ```
5. **Develop frontend**: Use mock data or point to deployed API

### Backend Development
1. **Local development**: `wrangler dev` starts local server on http://localhost:8787
2. **Database changes**: Update `schema.sql` and run `npm run db:init`
3. **AWS credentials**: Configure in `.env.local` (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
4. **Deployment**: `npm run deploy` pushes to Cloudflare Workers

### Frontend Development
1. **Start with mock data**: Uses `src/services/mockData.ts` for development
2. **Build all screens**: Home, preview, gallery, retention features (WOTD, Shuffle, Set as Wallpaper)
3. **Connect to API**: Update `src/services/api.ts` when backend is deployed
4. **Environment variables**: Use `expo-env.d.ts` and `app.json` for configuration

## 🏗️ Key Architecture Points

### Image Processing Pipeline
```
Local Folder → [upload.sh] → R2 + D1 → [tagging.sh] → Tags in D1/CSV → API → App
```

### Image Upload Script (`upload.ts`)
- Scans for `.jpg`, `.jpeg`, `.png`, `.webp` files
- Skips landscape/desktop images (width >= height OR aspect ratio > 0.65)
- Generates 400px-wide WebP thumbnails
- Uploads full image + thumbnail to R2
- Inserts metadata (dimensions, file size, R2 keys) into D1
- Avoids duplicates by checking existing filenames

### Image Tagging Script (`image-tagging.ts`)
- Uses AWS Rekognition to detect labels in images
- Stores results in `labels_output.jsonl`
- Can be converted to CSV with `jsonl-to-csv.ts`

### API Endpoints
- `GET /api/wallpapers?page=&limit=` - Paginated wallpaper list with tags
- `GET /api/wallpapers/:id` - Single wallpaper with all metadata and tags
- `GET /api/health` - Health check

### Image Loading Strategy
- **Grid**: Loads thumbnails (`r2_url_thumb`) via `expo-image` (cached, placeholder blur)
- **Preview**: Loads full-resolution (`r2_url_full`) with thumbnail as placeholder

## 📱 Device Testing
- **Expo Good for**: UI development, JavaScript debugging, most functionality
- **Required for Wallpaper Features**: 
  - Setting wallpaper (`react-native-manage-wallpaper` or custom native module)
  - Testing on physical Android device via `npx expo run:android`
  - Cannot test wallpaper setting in Expo Go or web

## 📚 Important References
- [Expo SDK 57 Documentation](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router Documentation](https://expo.github.io/router/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [AWS Rekognition Documentation](https://docs.aws.amazon.com/rekognition/)

## 🚦 Getting Started Checklist
1. [ ] Clone repository
2. [ ] Run `npm install` in root
3. [ ] Run `npm install` in `wallepi-backend/`
4. [ ] Set up Cloudflare account and install Wrangler
5. [ ] Create Cloudflare resources (R2 bucket, D1 database)
6. [ ] Configure `wrangler.toml` with IDs from step 5 (remove KV section)
7. [ ] Set up AWS account and get credentials for Rekognition
8. [ ] Create `.env.local` in `wallepi-backend/` with AWS credentials
9. [ ] Initialize database: `cd wallepi-backend && npm run db:init`
10. [ ] Download wallpapers locally from Google Photos
11. [ ] Run upload script: `npm run upload -- "/path/to/wallpapers"`
12. [ ] Run tagging script: `npm run tag`
13. [ ] Start backend dev: `npm run dev` (in wallepi-backend/)
14. [ ] Start frontend: `npm start` (in root)
15. [ ] For wallpaper features: Run on Android device with `npm run android`