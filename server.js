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
app.use(express.json()); // allow JSON bodies

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
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
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
    const filePublicId = `uploads/${path.parse(fileName).name}`;

    const result = await uploadToCloudinary(imageBuffer, {
      public_id: filePublicId,
    });

    console.log('Upload successful:', result.public_id);

    res.json({
      success: true,
      urls: {
        cloudURL: result.secure_url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Cloudinary upload failed',
      message: error.message,
    });
  }
});

// DELETE route: /delete-image
app.delete('/delete-image', async (req, res) => {
  console.log('DELETE request received');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  
  const { public_id } = req.body;

  if (!public_id) {
    console.log('Missing public_id in request');
    return res.status(400).json({ 
      success: false, 
      error: 'Missing public_id in request body',
      received: req.body
    });
  }

  console.log('Attempting to delete image with public_id:', public_id);

  try {
    // First, let's check if the image exists
    let imageExists = false;
    try {
      const resourceInfo = await cloudinary.api.resource(public_id, {
        resource_type: 'image'
      });
      imageExists = true;
      console.log('Image found:', resourceInfo.public_id);
    } catch (checkError) {
      console.log('Image check error:', checkError.message);
      if (checkError.error && checkError.error.http_code === 404) {
        return res.status(404).json({
          success: false,
          error: 'Image not found',
          message: 'The image with the provided public_id does not exist'
        });
      }
    }

    // Attempt to delete the image
    const result = await cloudinary.uploader.destroy(public_id, {
      resource_type: 'image',
      invalidate: true // Invalidate CDN cache
    });

    console.log('Delete result:', result);

    // Check various possible results
    if (result.result === 'ok') {
      res.json({ 
        success: true, 
        message: 'Image deleted successfully', 
        result 
      });
    } else if (result.result === 'not found') {
      res.status(404).json({
        success: false,
        error: 'Image not found',
        message: 'The image with the provided public_id does not exist',
        result
      });
    } else {
      // Handle other possible results
      res.status(400).json({
        success: false,
        error: 'Image deletion failed',
        message: `Deletion returned: ${result.result}`,
        result
      });
    }

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Cloudinary delete failed',
      message: error.message,
      details: error
    });
  }
});


// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET /health - Health check`);
  console.log(`   POST /upload-image - Upload an image`);
  console.log(`   DELETE /delete-image - Delete an image by public_id`);

});
