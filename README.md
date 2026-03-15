# 🔍 FindIt — Lost & Found Platform

A modern, full-stack Lost & Found web application with a dark, premium UI. Built with React (frontend), Node.js + Express (backend), MongoDB (database), and Cloudinary (image storage).

---

## 📁 Folder Structure

```
findit/
├── index.html                  ← Standalone frontend (open directly in browser)
│
├── backend/
│   ├── server.js               ← Express app + all routes
│   ├── package.json
│   ├── .env.example            ← Copy to .env and fill in your values
│   └── .gitignore
│
├── frontend/                   ← (Optional) React/Next.js version
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Hero.jsx
│   │   │   ├── ItemCard.jsx
│   │   │   ├── ItemForm.jsx
│   │   │   ├── ItemDetail.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   └── AdminPanel.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Listings.jsx
│   │   │   └── Admin.jsx
│   │   └── api/
│   │       └── items.js        ← API helper functions
│   ├── package.json
│   └── .env.example
│
└── README.md
```

---

## 🚀 Quick Start

### Option A — Standalone (No Backend Needed)
Just open `index.html` in your browser. Everything works with localStorage.

### Option B — Full Stack

#### 1. Clone and install

```bash
git clone <your-repo>
cd findit/backend
npm install
```

#### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI, Cloudinary keys, and admin token
```

#### 3. Set up Cloudinary (Free tier works great)
1. Create account at https://cloudinary.com
2. Go to Dashboard → copy Cloud Name, API Key, API Secret
3. Paste into your `.env`

#### 4. Set up MongoDB
- **Local**: Install MongoDB Community, it runs on `mongodb://localhost:27017`
- **Cloud**: Create free cluster at https://cloud.mongodb.com, get connection string

#### 5. Run the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server starts at `http://localhost:5000`

---

## 📡 API Reference

### Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | List items with filters |
| GET | `/api/items/:id` | Get single item |
| POST | `/api/items` | Create new item (multipart/form-data) |
| PATCH | `/api/items/:id/status` | Update status (returned, etc.) |

#### GET `/api/items` — Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | — | Full-text search (name, desc, location) |
| `type` | lost\|found | — | Filter by type |
| `status` | lost\|found\|returned | — | Filter by status |
| `location` | string | — | Filter by location (partial match) |
| `page` | number | 1 | Pagination page |
| `limit` | number | 20 | Items per page (max 50) |
| `sort` | newest\|oldest\|name | newest | Sort order |

**Example:**
```
GET /api/items?search=wallet&type=lost&page=1&limit=10
```

#### POST `/api/items` — Create Item

Send as `multipart/form-data`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | ✅ | `lost` or `found` |
| `name` | string | ✅ | Item name (max 100 chars) |
| `desc` | string | ✅ | Description (max 1000 chars) |
| `location` | string | ✅ | Where it was lost/found |
| `date` | string | ✅ | ISO date (YYYY-MM-DD) |
| `contact` | string | ✅ | Email or phone |
| `photo` | file | ❌ | Image file (jpg/png/webp, max 5MB) |

### Admin Routes (require `x-admin-token` header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/items` | All items including unapproved |
| DELETE | `/api/admin/items/:id` | Delete item + image |
| PATCH | `/api/admin/items/:id/approve` | Approve or hide item |

---

## 🗄️ Database Schema

```javascript
// Item Schema (MongoDB/Mongoose)
{
  type:          'lost' | 'found',    // required
  name:          String,              // required, max 100 chars
  desc:          String,              // required, max 1000 chars
  location:      String,              // required, max 200 chars
  date:          Date,                // required
  contact:       String,              // required (email or phone)
  photo:         String,              // Cloudinary URL
  photoPublicId: String,              // for deletion
  status:        'lost'|'found'|'returned',  // default = type
  submitterIp:   String,              // for spam tracking
  isApproved:    Boolean,             // default: true
  createdAt:     Date,                // auto
  updatedAt:     Date,                // auto
}

// Indexes:
// - Text index on: name, desc, location  (for search)
// - { createdAt: -1 }                    (for sorting)
// - { type: 1, status: 1 }               (for filtering)
```

---

## 🎨 Frontend Features

### Pages
- **Home** — Hero section, stats counter, recent items preview
- **Listings** — All items with search, filters, and sort
- **Admin Panel** — Remove fake/inappropriate posts

### Components
- **Item Cards** — Photo, name, location, date, status badge
- **Report Form** — Type toggle, photo upload preview, all fields
- **Detail Modal** — Full image, description, map link, contact info
- **Filter Bar** — Search input + type/status dropdowns

### UI Design
- Dark theme with purple/teal accent gradient
- Syne (display) + DM Sans (body) typography
- Smooth transitions and hover effects
- Fully responsive (mobile-first)
- localStorage for offline/demo mode

---

## 🛡️ Anti-Spam Features

1. **Rate limiting** — Max 10 item submissions per IP per hour
2. **IP logging** — Submitter IP stored for admin reference
3. **Field validation** — Server-side validation on all fields
4. **File type validation** — Only images allowed, 5MB limit
5. **Admin panel** — Manually hide or delete fake posts
6. **Optional pre-approval** — Set `isApproved: false` by default for manual review

---

## 🌐 Deployment

### Backend — Railway / Render / Heroku

**Railway (recommended, free tier):**
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
# Add environment variables in Railway dashboard
```

**Render:**
1. Connect GitHub repo
2. New → Web Service → select backend folder
3. Build: `npm install` | Start: `node server.js`
4. Add environment variables

**Environment variables to set:**
- `MONGODB_URI` — MongoDB Atlas connection string
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `ADMIN_TOKEN` — Long random string
- `CLIENT_URL` — Your frontend domain
- `NODE_ENV=production`

### Frontend — Vercel / Netlify

For the standalone `index.html`:
```bash
# Netlify drop — just drag index.html to netlify.com/drop
# Or via CLI:
npm install -g netlify-cli
netlify deploy --prod --dir .
```

For a React/Next.js version:
```bash
# Vercel
npx vercel --prod
```

### Database — MongoDB Atlas (Free Tier)
1. Go to https://cloud.mongodb.com
2. Create free M0 cluster
3. Add database user
4. Whitelist `0.0.0.0/0` (or specific IPs)
5. Get connection string → paste in `MONGODB_URI`

---

## 🔧 Connecting Frontend to Backend

Update the API base URL in `index.html` or your React `api/items.js`:

```javascript
// In index.html, replace the state management with API calls:
const API_BASE = 'https://your-backend.railway.app/api';

async function fetchItems(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/items?${qs}`);
  return res.json();
}

async function submitItem(formData) {
  const res = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    body: formData, // FormData object for file upload
  });
  return res.json();
}
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML/CSS/JS (standalone) or React 18 |
| Backend | Node.js 18 + Express 4 |
| Database | MongoDB 7 + Mongoose 8 |
| Images | Cloudinary (free: 25GB storage) |
| Rate limiting | express-rate-limit |
| Deployment | Railway / Render + MongoDB Atlas |

---

## 📝 License

MIT — free to use and modify.
