const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');

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

// MongoDB connection with fallback
let isMongoConnected = false;
let employees = loadSharedData().employees; // Load from shared file

let leaves = []; // In-memory leave storage

mongoose.connect('mongodb://localhost:27017/erp_system')
  .then(() => {
    console.log('MongoDB connected successfully');
    isMongoConnected = true;
  })
  .catch(err => {
    console.log('MongoDB connection error:', err.message);
    console.log('Using in-memory employee data');
    isMongoConnected = false;
  });

// Schemas
const employeeSchema = new mongoose.Schema({
  empId: String,
  name: String,
  email: String,
  password: String,
  position: String
});

const leaveSchema = new mongoose.Schema({
  empId: String,
  date: Date,
  reason: String,
  granted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Employee = mongoose.model('Employee', employeeSchema);
const Leave = mongoose.model('Leave', leaveSchema);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = 'employee-jwt-secret';

// JWT middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/login', async (req, res) => {
  const { empId, password } = req.body;
  console.log('Login attempt:', { empId, password });
  console.log('MongoDB connected:', isMongoConnected);
  
  let employee;
  
  try {
    if (isMongoConnected) {
      console.log('Searching for employee in MongoDB...');
      employee = await Employee.findOne({ empId });
      console.log('Employee found:', employee ? 'Yes' : 'No');
      
      if (!employee) {
        console.log('Employee not found in database');
        return res.status(401).json({ error: 'Employee not found. Please contact admin.' });
      }
      
      console.log('Comparing password...');
      // Use the actual password from Q4 (which is hashed)
      const isValidPassword = await bcrypt.compare(password, employee.password);
      console.log('Password valid:', isValidPassword);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }
      
    } else {
      console.log('Using shared data file...');
      // Load fresh data from shared file
      const sharedData = loadSharedData();
      employee = sharedData.employees.find(emp => emp.empId === empId);
      console.log('Employee found in shared data:', employee ? 'Yes' : 'No');
      
      if (!employee) {
        return res.status(401).json({ error: 'Employee not found. Please contact admin.' });
      }
      
      // For shared data, compare plain text password (since Q4 stores plain text in shared file)
      if (employee.password !== password) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }
    
    console.log('Login successful for:', employee.empId);
    const token = jwt.sign({ empId: employee.empId, name: employee.name }, JWT_SECRET);
    res.json({ token, employee: { empId: employee.empId, name: employee.name, email: employee.email, position: employee.position } });
  } catch (error) {
    console.log('Login error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    let employee;
    if (isMongoConnected) {
      employee = await Employee.findOne({ empId: req.user.empId });
    } else {
      employee = employees.find(emp => emp.empId === req.user.empId);
    }
    res.json(employee);
  } catch (error) {
    const employee = employees.find(emp => emp.empId === req.user.empId);
    res.json(employee);
  }
});

app.post('/api/leave', authenticateToken, async (req, res) => {
  try {
    const { date, reason } = req.body;
    const leaveData = {
      _id: Date.now(),
      empId: req.user.empId,
      date: new Date(date),
      reason,
      granted: false,
      createdAt: new Date()
    };
    
    if (isMongoConnected) {
      const leave = new Leave(leaveData);
      await leave.save();
    } else {
      leaves.push(leaveData);
    }
    
    res.json({ message: 'Leave application submitted' });
  } catch (error) {
    const leaveData = {
      _id: Date.now(),
      empId: req.user.empId,
      date: new Date(req.body.date),
      reason: req.body.reason,
      granted: false,
      createdAt: new Date()
    };
    leaves.push(leaveData);
    res.json({ message: 'Leave application submitted' });
  }
});

app.get('/api/leaves', authenticateToken, async (req, res) => {
  try {
    let userLeaves;
    if (isMongoConnected) {
      userLeaves = await Leave.find({ empId: req.user.empId });
    } else {
      userLeaves = leaves.filter(leave => leave.empId === req.user.empId);
    }
    res.json(userLeaves);
  } catch (error) {
    const userLeaves = leaves.filter(leave => leave.empId === req.user.empId);
    res.json(userLeaves);
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(3005, () => {
  console.log('Employee JWT Server running on http://localhost:3005');
});