
  // const express = require('express');
  // const mongoose = require('mongoose');
  // const cors = require('cors');
  // const multer = require('multer');
  // const { spawn } = require('child_process');
  // const path = require('path');
  // const fs = require('fs');

  // const app = express();
  // const PORT = process.env.PORT || 5000;
  // server.js
  import express from 'express';
  import mongoose from 'mongoose';
  import cors from 'cors';
  import multer from 'multer';
  import { spawn } from 'child_process';
  import path from 'path';
  import fs from 'fs';
  import { fileURLToPath } from 'url';
  import { dirname } from 'path';

  // Workaround for __dirname in ES Modules
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const app = express();
  const PORT = process.env.PORT || 5000;
  // Middleware
  app.use(cors());
  app.use(express.json());
  //mongodb+srv://rithwikareddysama63:@rith231@cluster0.mongodb.net/video_analyzer
  // Connect to MongoDB Atlas mongodb+srv://rithwikareddysama63:@rith231@cluster0.m1bls84.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
  mongoose.connect('mongodb://localhost:27017/videoanalysis', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB Compass'))
  .catch(err => console.error('MongoDB connection error:', err));

  // Define User Schema
  const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    videos: [{
      videoId: String,
      title: String,
      uploadDate: Date,
      transcript: String,
      summary: String,
      keywords: [String]
    }]
  });

  const User = mongoose.model('User', userSchema);

  // Define Analysis Status Schema
  const analysisSchema = new mongoose.Schema({
    analysisId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    status: { type: String, default: 'pending' },
    currentStep: String,
    progress: Number,
    result: {
      title: String,
      transcript: String,
      summary: String,
      keywords: [String]
    },
    error: String,
    createdAt: { type: Date, default: Date.now }
  });

  const Analysis = mongoose.model('Analysis', analysisSchema);

  // Set up file upload with multer
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });

  const upload = multer({ storage });

  // API Routes
  // User registration
  app.post('/api/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      
      // Create new user
      const newUser = new User({
        username,
        email,
        password, // In production, hash the password
      });
      
      await newUser.save();
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // User login
  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      
      // Check password (in production, compare hashed passwords)
      if (user.password !== password) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      
      res.json({ 
        message: 'Login successful',
        user: {
          name: user.username,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Video analysis endpoint
  app.post('/api/analyze-video', upload.single('video'), async (req, res) => {
    try {
      const { userId, analysisId } = req.body;
      const videoPath = req.file.path;
      
      // Create a new analysis record
      const analysis = new Analysis({
        analysisId,
        userId,
        status: 'processing',
        currentStep: 'Extracting audio',
        progress: 10
      });
      
      await analysis.save();
      
      // Start the Python analysis process
      const pythonProcess = spawn('python', ['video_analyzer.py', videoPath, analysisId]);
      
      pythonProcess.on('error', async (error) => {
        console.error('Failed to start Python process:', error);
        await Analysis.findOneAndUpdate(
          { analysisId },
          { 
            status: 'failed',
            error: 'Failed to start analysis process'
          }
        );
      });
      
      // Process is started in background, respond immediately
      res.status(200).json({ 
        message: 'Analysis started', 
        analysisId
      });
    } catch (error) {
      console.error('Video analysis error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Get analysis status endpoint
  app.get('/api/analysis-status/:analysisId', async (req, res) => {
    try {
      const { analysisId } = req.params;
      
      const analysis = await Analysis.findOne({ analysisId });
      
      if (!analysis) {
        return res.status(404).json({ message: 'Analysis not found' });
      }
      
      res.json({
        status: analysis.status,
        currentStep: analysis.currentStep,
        progress: analysis.progress,
        result: analysis.status === 'completed' ? analysis.result : null,
        error: analysis.error
      });
    } catch (error) {
      console.error('Get analysis status error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Get user video history
  app.get('/api/user/videos/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await User.findOne({ email: userId });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ videos: user.videos });
    } catch (error) {
      console.error('Get user videos error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
