import express from "express";
import cors from "cors";
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import User from "./models/user.js";

const port = process.env.PORT || 3000;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  })
);

app.use(express.json());

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Unauthorized", message: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production', (err, user) => {
    if (err) {
      console.error("JWT verification error:", err);
      return res.status(403).json({ error: "Forbidden", message: "Invalid or expired token" });
    }
    req.user = user;
    req.userId = user.userId;
    next();
  });
};

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log(err);
  }
};

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

app.get("/api/upload", authenticateToken, (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

// Auth Routes
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create new user
    const user = new User({ email, password, name });
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
    }
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({ error: "User with this email already exists" });
    }
    res.status(500).json({ error: "Error creating user", message: err.message });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ error: "Error signing in", message: err.message });
  }
});

// Get current user
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({
      id: user._id,
      email: user.email,
      name: user.name,
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Error fetching user", message: err.message });
  }
});

// Chat Routes
app.post("/api/chats", authenticateToken, async (req, res) => {
  const userId = req.userId;
  const { text } = req.body;

  try {
    // CREATE A NEW CHAT
    const newChat = new Chat({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });
    
    const savedChat = await newChat.save();

    // CHECK IF THE USERCHATS EXISTS
    const userChats = await UserChats.findOne({ userId: userId });

    // IF DOESN'T EXIST CREATE A NEW ONE AND ADD THE CHAT IN THE CHATS ARRAY
    if (!userChats) {
      const newUserChats = new UserChats({
        userId: userId,
        chats: [
          {
            _id: savedChat._id,
            title: text.substring(0, 40),
          },
        ],
      });

      await newUserChats.save();
      res.status(201).send(savedChat._id);
    } else {
      // IF EXISTS, PUSH THE CHAT TO THE EXISTING ARRAY
      await UserChats.updateOne(
        { userId: userId },
        {
          $push: {
            chats: {
              _id: savedChat._id,
              title: text.substring(0, 40),
            },
          },
        }
      );

      res.status(201).send(savedChat._id);
    }
  } catch (err) {
    console.error("Error creating chat:", err);
    res.status(500).json({ error: "Error creating chat!", message: err.message });
  }
});

app.get("/api/userchats", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    const userChats = await UserChats.findOne({ userId });

    // If no user chats found, return empty array
    if (!userChats) {
      return res.status(200).send([]);
    }

    res.status(200).send(userChats.chats || []);
  } catch (err) {
    console.error("Error fetching userchats:", err);
    res.status(500).json({ error: "Error fetching userchats!", message: err.message });
  }
});

app.get("/api/chats/:id", authenticateToken, async (req, res) => {
  const userId = req.userId;

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.status(200).send(chat);
  } catch (err) {
    console.error("Error fetching chat:", err);
    res.status(500).json({ error: "Error fetching chat!", message: err.message });
  }
});

app.put("/api/chats/:id", authenticateToken, async (req, res) => {
  const userId = req.userId;

  const { question, answer, img } = req.body;

  const newItems = [
    ...(question
      ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
      : []),
    { role: "model", parts: [{ text: answer }] },
  ];

  try {
    const updatedChat = await Chat.updateOne(
      { _id: req.params.id, userId },
      {
        $push: {
          history: {
            $each: newItems,
          },
        },
      }
    );
    res.status(200).send(updatedChat);
  } catch (err) {
    console.error("Error updating chat:", err);
    res.status(500).json({ error: "Error adding conversation!", message: err.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error middleware caught:", err);
  console.error("Stack:", err.stack);
  
  if (err.status === 401 || err.message?.includes('Unauthorized')) {
    return res.status(401).json({ error: "Unauthenticated!", message: err.message });
  }
  
  res.status(500).json({ error: "Server error!", message: err.message });
});

// PRODUCTION
if (process.env.NODE_ENV === "production" && process.env.CLIENT_URL) {
  app.get("*", (req, res) => {
    res.redirect(process.env.CLIENT_URL);
  });
} else {
  app.use(express.static(path.join(__dirname, "../client/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
  });
}

app.listen(port, () => {
  connect();
  console.log(`Server running on port ${port}`);
});
