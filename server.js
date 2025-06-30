require('dotenv').config(); // Load env vars

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const path = require('path');

// Set up Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer: use memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Create Express app
const app = express();
app.use(cors()); // allow all origins

// Upload helper
function uploadToCloudinary(imageBuffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: options.folder || 'uploads',
        public_id: options.public_id,
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(imageBuffer);
  });
}

// POST route: /upload-image
app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const imageBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname}`;

    const cloudURL = await uploadToCloudinary(imageBuffer, {
      public_id: path.parse(fileName).name,
    });

    res.json({
      success: true,
      urls: {
        cloudURL,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Cloudinary upload failed',
      message: error.message,
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
