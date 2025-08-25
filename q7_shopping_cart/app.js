const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const multer = require('multer');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/shopping_cart');

// Schemas
const categorySchema = new mongoose.Schema({
  name: String,
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }
});

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  image: String,
  stock: Number
});

const Category = mongoose.model('Category', categorySchema);
const Product = mongoose.model('Product', productSchema);

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: 'shopping-secret',
  resave: false,
  saveUninitialized: false
}));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.session.admin) next();
  else res.redirect('/admin/login');
};

// Routes
app.get('/', async (req, res) => {
  const categories = await Category.find({ parentId: null }).populate('parentId');
  const products = await Product.find().populate('categoryId');
  res.render('user/index', { categories, products, cart: req.session.cart || [] });
});

app.post('/add-to-cart/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!req.session.cart) req.session.cart = [];
  
  const existingItem = req.session.cart.find(item => item.id === req.params.id);
  if (existingItem) {
    existingItem.quantity++;
  } else {
    req.session.cart.push({
      id: product._id,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }
  res.redirect('/');
});

// Admin routes
app.get('/admin/login', (req, res) => {
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res) => {
  if (req.body.username === 'admin' && req.body.password === 'admin123') {
    req.session.admin = true;
    res.redirect('/admin');
  } else {
    res.render('admin/login', { error: 'Invalid credentials' });
  }
});

app.get('/admin', requireAdmin, async (req, res) => {
  const categories = await Category.find().populate('parentId');
  const products = await Product.find().populate('categoryId');
  res.render('admin/dashboard', { categories, products });
});

app.post('/admin/category', requireAdmin, async (req, res) => {
  const category = new Category(req.body);
  await category.save();
  res.redirect('/admin');
});

app.post('/admin/product', requireAdmin, upload.single('image'), async (req, res) => {
  const product = new Product({
    ...req.body,
    image: req.file ? req.file.filename : null
  });
  await product.save();
  res.redirect('/admin');
});

app.listen(3007, () => {
  console.log('Shopping Cart Server running on http://localhost:3007');
});