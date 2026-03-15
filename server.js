const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting (spam prevention) ──────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 submissions per hour per IP
  message: { error: 'Too many submissions. Please try again in an hour.' },
});

app.use('/api/', limiter);

// ─── Cloudinary Config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'findit',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'limit', quality: 'auto' }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files are allowed.'));
  },
});

// ─── Database Connection ───────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/findit')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// ─── Models ───────────────────────────────────────────────────────────────────
const itemSchema = new mongoose.Schema({
  type: { type: String, enum: ['lost', 'found'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  desc: { type: String, required: true, trim: true, maxlength: 1000 },
  location: { type: String, required: true, trim: true, maxlength: 200 },
  date: { type: Date, required: true },
  contact: { type: String, required: true, trim: true, maxlength: 100 },
  photo: { type: String, default: '' },
  photoPublicId: { type: String, default: '' },
  status: { type: String, enum: ['lost', 'found', 'returned'], default: function() { return this.type; } },
  submitterIp: { type: String },
  isApproved: { type: Boolean, default: true }, // set false for manual review flow
}, { timestamps: true });

// Text index for search
itemSchema.index({ name: 'text', desc: 'text', location: 'text' });
itemSchema.index({ createdAt: -1 });
itemSchema.index({ type: 1, status: 1 });

const Item = mongoose.model('Item', itemSchema);

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getClientIp = (req) =>
  req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/items — list with search, filter, sort, pagination
app.get('/api/items', async (req, res) => {
  try {
    const {
      search = '',
      type,         // 'lost' | 'found'
      status,       // 'lost' | 'found' | 'returned'
      location,
      page = 1,
      limit = 20,
      sort = 'newest',
    } = req.query;

    const query = { isApproved: true };

    if (search) query.$text = { $search: search };
    if (type && ['lost', 'found'].includes(type)) query.type = type;
    if (status && ['lost', 'found', 'returned'].includes(status)) query.status = status;
    if (location) query.location = { $regex: location, $options: 'i' };

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { name: 1 },
    };

    const sortBy = sortMap[sort] || sortMap.newest;
    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
    const lim = Math.min(50, parseInt(limit));

    const [items, total] = await Promise.all([
      Item.find(query).sort(sortBy).skip(skip).limit(lim).lean(),
      Item.countDocuments(query),
    ]);

    res.json({
      items,
      pagination: { total, page: parseInt(page), limit: lim, pages: Math.ceil(total / lim) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch items.' });
  }
});

// GET /api/items/:id — single item
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).lean();
    if (!item || !item.isApproved) return res.status(404).json({ error: 'Item not found.' });
    res.json(item);
  } catch {
    res.status(404).json({ error: 'Item not found.' });
  }
});

// POST /api/items — create item
app.post('/api/items', submitLimiter, upload.single('photo'), async (req, res) => {
  try {
    const { type, name, desc, location, date, contact } = req.body;

    if (!type || !name || !desc || !location || !date || !contact)
      return res.status(400).json({ error: 'All fields are required.' });

    if (!['lost', 'found'].includes(type))
      return res.status(400).json({ error: 'Type must be "lost" or "found".' });

    if (name.trim().length < 2) return res.status(400).json({ error: 'Item name too short.' });

    const item = new Item({
      type: type.trim(),
      name: name.trim(),
      desc: desc.trim(),
      location: location.trim(),
      date: new Date(date),
      contact: contact.trim(),
      photo: req.file?.path || '',
      photoPublicId: req.file?.filename || '',
      submitterIp: getClientIp(req),
    });

    await item.save();
    res.status(201).json({ message: 'Item reported successfully.', item });
  } catch (err) {
    console.error(err);
    if (req.file?.filename) await cloudinary.uploader.destroy(req.file.filename);
    res.status(500).json({ error: 'Failed to create item.' });
  }
});

// PATCH /api/items/:id/status — mark returned
app.patch('/api/items/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['lost', 'found', 'returned'].includes(status))
      return res.status(400).json({ error: 'Invalid status.' });

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json({ message: 'Status updated.', item });
  } catch {
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// ─── Admin Routes (protect with JWT in production) ─────────────────────────────
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'Unauthorized.' });
  next();
};

// GET /api/admin/items — all items including unapproved
app.get('/api/admin/items', adminAuth, async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch {
    res.status(500).json({ error: 'Failed to fetch.' });
  }
});

// DELETE /api/admin/items/:id — remove post
app.delete('/api/admin/items/:id', adminAuth, async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    if (item.photoPublicId) await cloudinary.uploader.destroy(item.photoPublicId);
    res.json({ message: 'Item deleted.' });
  } catch {
    res.status(500).json({ error: 'Failed to delete.' });
  }
});

// PATCH /api/admin/items/:id/approve — approve/unapprove
app.patch('/api/admin/items/:id/approve', adminAuth, async (req, res) => {
  try {
    const { isApproved } = req.body;
    const item = await Item.findByIdAndUpdate(req.params.id, { isApproved }, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    res.json({ message: `Item ${isApproved ? 'approved' : 'hidden'}.`, item });
  } catch {
    res.status(500).json({ error: 'Failed to update.' });
  }
});

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Error handler
app.use((err, req, res, next) => {
  if (err.message?.includes('image')) return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app;
