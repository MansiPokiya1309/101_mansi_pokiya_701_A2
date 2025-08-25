const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();

// Shared data file for employee storage
const fs = require('fs');
const path = require('path');
const sharedDataPath = path.join(__dirname, '..', 'shared_data.json');

// Load shared data
function loadSharedData() {
  try {
    const data = fs.readFileSync(sharedDataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { employees: [] };
  }
}

// Save shared data
function saveSharedData(data) {
  try {
    fs.writeFileSync(sharedDataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Error saving shared data:', error.message);
  }
}

// In-memory storage (fallback when MongoDB is not available)
let employees = [];
let employeeIdCounter = 1;

// MongoDB connection with error handling
let isMongoConnected = false;
mongoose.connect('mongodb://localhost:27017/erp_system')
  .then(() => {
    console.log('MongoDB connected successfully');
    isMongoConnected = true;
  })
  .catch(err => {
    console.log('MongoDB connection error:', err.message);
    console.log('Using in-memory storage instead');
    isMongoConnected = false;
  });

// Employee Schema
const employeeSchema = new mongoose.Schema({
  empId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  position: String,
  baseSalary: Number,
  bonus: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  totalSalary: Number
});

const Employee = mongoose.model('Employee', employeeSchema);

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'admin-secret',
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: false, 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true
  }
}));

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'dharmikjikadarapvt@gmail.com',
    pass: 'ksnf ahoe qeis nazq'
  }
});

// Admin credentials
const ADMIN = { username: 'admin', password: 'admin123' };

// Middleware to check admin login
const requireAdmin = (req, res, next) => {
  console.log('Checking admin session:', req.session.admin);
  if (req.session.admin) {
    next();
  } else {
    console.log('No admin session, redirecting to login');
    res.redirect('/login');
  }
};

// Routes
app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password });
  console.log('Session before login:', req.session);
  
  if (username === ADMIN.username && password === ADMIN.password) {
    req.session.admin = true;
    req.session.save((err) => {
      if (err) {
        console.log('Session save error:', err);
        return res.render('login', { error: 'Session error' });
      }
      console.log('Login successful, session saved:', req.session.admin);
      res.redirect('/dashboard');
    });
  } else {
    console.log('Login failed');
    res.render('login', { error: 'Invalid credentials' });
  }
});

app.get('/dashboard', requireAdmin, async (req, res) => {
  console.log('Dashboard accessed, loading employees');
  try {
    if (isMongoConnected) {
      const employeeList = await Employee.find();
      res.render('dashboard', { employees: employeeList });
    } else {
      res.render('dashboard', { employees });
    }
  } catch (error) {
    console.log('Database error:', error.message);
    res.render('dashboard', { employees });
  }
});

// Add a test route to bypass authentication for debugging
app.get('/test-dashboard', async (req, res) => {
  console.log('Test dashboard accessed');
  try {
    const employees = await Employee.find();
    res.render('dashboard', { employees });
  } catch (error) {
    console.log('Database error in test route:', error.message);
    res.render('dashboard', { employees: [] });
  }
});

app.get('/add-employee', requireAdmin, (req, res) => {
  res.render('add-employee', { error: null });
});

app.post('/add-employee', requireAdmin, async (req, res) => {
  try {
    const { name, email, position, baseSalary, bonus, deductions } = req.body;
    const empId = 'EMP' + Date.now();
    const password = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const totalSalary = parseFloat(baseSalary) + parseFloat(bonus || 0) - parseFloat(deductions || 0);
    
    const employeeData = {
      _id: employeeIdCounter++,
      empId,
      name,
      email,
      password: hashedPassword,
      position,
      baseSalary: parseFloat(baseSalary),
      bonus: parseFloat(bonus || 0),
      deductions: parseFloat(deductions || 0),
      totalSalary
    };
    
    if (isMongoConnected) {
      const employee = new Employee(employeeData);
      await employee.save();
    } else {
      employees.push(employeeData);
      // Also save to shared file
      const sharedData = loadSharedData();
      sharedData.employees.push(employeeData);
      saveSharedData(sharedData);
    }
    
    // Send email to employee
    try {
      await transporter.sendMail({
        from: 'dharmikjikadarapvt@gmail.com',
        to: email,
        subject: 'Employee Account Created - ERP System',
        html: `
          <h2>Welcome to ERP System</h2>
          <p>Dear ${name},</p>
          <p>Your employee account has been created successfully.</p>
          <p><strong>Employee ID:</strong> ${empId}</p>
          <p><strong>Password:</strong> ${password}</p>
          <p><strong>Position:</strong> ${position}</p>
          <p><strong>Salary Details:</strong></p>
          <ul>
            <li>Base Salary: $${baseSalary}</li>
            <li>Bonus: $${bonus || 0}</li>
            <li>Deductions: $${deductions || 0}</li>
            <li>Total Salary: $${totalSalary}</li>
          </ul>
          <p>Please keep your credentials secure.</p>
          <p>Best regards,<br>HR Team</p>
        `
      });
      console.log(`Email sent successfully to ${email}`);
    } catch (emailError) {
      console.log(`Email failed to send: ${emailError.message}`);
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    res.render('add-employee', { error: error.message });
  }
});

app.get('/edit-employee/:id', requireAdmin, async (req, res) => {
  try {
    let employee;
    if (isMongoConnected) {
      employee = await Employee.findById(req.params.id);
    } else {
      employee = employees.find(emp => emp._id == req.params.id);
    }
    res.render('edit-employee', { employee, error: null });
  } catch (error) {
    res.redirect('/dashboard');
  }
});

app.post('/edit-employee/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, position, baseSalary, bonus, deductions } = req.body;
    const totalSalary = parseFloat(baseSalary) + parseFloat(bonus || 0) - parseFloat(deductions || 0);
    
    if (isMongoConnected) {
      await Employee.findByIdAndUpdate(req.params.id, {
        name,
        email,
        position,
        baseSalary: parseFloat(baseSalary),
        bonus: parseFloat(bonus || 0),
        deductions: parseFloat(deductions || 0),
        totalSalary
      });
    } else {
      const empIndex = employees.findIndex(emp => emp._id == req.params.id);
      if (empIndex !== -1) {
        employees[empIndex] = {
          ...employees[empIndex],
          name,
          email,
          position,
          baseSalary: parseFloat(baseSalary),
          bonus: parseFloat(bonus || 0),
          deductions: parseFloat(deductions || 0),
          totalSalary
        };
      }
    }
    
    res.redirect('/dashboard');
  } catch (error) {
    let employee;
    if (isMongoConnected) {
      employee = await Employee.findById(req.params.id);
    } else {
      employee = employees.find(emp => emp._id == req.params.id);
    }
    res.render('edit-employee', { employee, error: error.message });
  }
});

app.post('/delete-employee/:id', requireAdmin, async (req, res) => {
  try {
    if (isMongoConnected) {
      await Employee.findByIdAndDelete(req.params.id);
    } else {
      const empIndex = employees.findIndex(emp => emp._id == req.params.id);
      if (empIndex !== -1) {
        employees.splice(empIndex, 1);
      }
    }
  } catch (error) {
    console.log('Delete error:', error.message);
  }
  res.redirect('/dashboard');
});

app.get('/show-passwords', requireAdmin, async (req, res) => {
  try {
    let employeeList;
    if (isMongoConnected) {
      employeeList = await Employee.find();
    } else {
      employeeList = employees;
    }
    
    let html = '<h2>Employee Passwords (For Testing)</h2><table border="1"><tr><th>Emp ID</th><th>Name</th><th>Email</th><th>Password (Hashed)</th></tr>';
    employeeList.forEach(emp => {
      html += `<tr><td>${emp.empId}</td><td>${emp.name}</td><td>${emp.email}</td><td>Check console when created</td></tr>`;
    });
    html += '</table><p><strong>Note:</strong> Passwords are hashed. Check server console for plain text passwords when employees were created.</p>';
    res.send(html);
  } catch (error) {
    res.send('Error loading employees');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.listen(3004, () => {
  console.log('Admin ERP Server running on http://localhost:3004');
});