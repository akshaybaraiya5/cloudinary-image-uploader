require('dotenv').config(); // Load environment variables first

const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors'); // Add this if frontend will access it remotely

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload function to Cloudinary
async function uploadToCloudinary(imageBuffer, options = {}) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                resource_type: 'image',
                folder: options.folder || 'uploads',
                public_id: options.public_id,
                ...options
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.secure_url); // Return only the secure URL
                }
            }
        ).end(imageBuffer);
    });
}

// Initialize Express
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Optional: Enable CORS if calling from frontend
app.use(cors());

// Route: Upload image
app.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const imageBuffer = req.file.buffer;
        const fileName = `${Date.now()}-${req.file.originalname}`;

        const cloudURL = await uploadToCloudinary(imageBuffer, {
            public_id: path.parse(fileName).name
        });

        res.json({ cloudURL });

    } catch (error) {
        res.status(500).json({
            error: 'Failed to upload to Cloudinary',
            message: error.message
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
