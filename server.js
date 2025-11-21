const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Google Vision API
async function extractTextFromImage(imageBuffer) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const base64Content = imageBuffer.toString('base64');

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: base64Content },
                    features: [{ type: 'TEXT_DETECTION' }]
                }]
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vision API error: ${error}`);
    }

    const result = await response.json();
    const textAnnotations = result.responses?.[0]?.textAnnotations || [];
    return textAnnotations.length > 0 ? textAnnotations[0].description || '' : '';
}

// Extract Israeli license plate pattern
function extractLicensePlate(text) {
    // Remove phone number patterns first
    const cleanedText = text
        .replace(/1[-–]?7\d{2}[-–]?\d{3}[-–]?\d{3}/g, '')  // 1-700-xxx-xxx
        .replace(/1[-–]?8\d{2}[-–]?\d{3}[-–]?\d{3}/g, '')  // 1-800-xxx-xxx
        .replace(/0\d[-–]?\d{7}/g, '');                     // 0x-xxxxxxx

    // Israeli license plate patterns - prioritize formatted ones
    const patterns = [
        // With dashes/spaces (most reliable)
        /(\d{3}[-–]\d{2}[-–]\d{3})/g,           // New: 123-45-678
        /(\d{2}[-–]\d{3}[-–]\d{2})/g,            // Old: 12-345-67
        /(\d{3}\s+\d{2}\s+\d{3})/g,              // With spaces
        /(\d{2}\s+\d{3}\s+\d{2})/g,              // With spaces
        // Plain 8 digits (new format)
        /\b(\d{8})\b/g,
        // Plain 7 digits (old format)
        /\b(\d{7})\b/g
    ];

    // Try each pattern and collect all matches
    let allMatches = [];

    for (const pattern of patterns) {
        const matches = cleanedText.matchAll(pattern);
        for (const match of matches) {
            const plate = match[1].replace(/[-–\s]/g, '');
            // Validate it's 7 or 8 digits
            if (plate.length === 7 || plate.length === 8) {
                allMatches.push({
                    plate,
                    hasFormat: match[1].includes('-') || match[1].includes('–') || /\d\s+\d/.test(match[1])
                });
            }
        }
    }

    // Prefer formatted plates (with dashes)
    const formatted = allMatches.find(m => m.hasFormat);
    if (formatted) return formatted.plate;

    // Otherwise return first valid match
    return allMatches[0]?.plate || null;
}

// License plate extraction endpoint
app.post('/api/extract-plate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image provided' });
        }

        const fullText = await extractTextFromImage(req.file.buffer);

        if (!fullText) {
            return res.status(404).json({
                success: false,
                error: 'No text detected in image'
            });
        }

        const licensePlate = extractLicensePlate(fullText);

        if (!licensePlate) {
            return res.status(404).json({
                success: false,
                error: 'No valid license plate found in image',
                detectedText: fullText
            });
        }

        res.json({
            success: true,
            licensePlate,
            detectedText: fullText
        });

    } catch (error) {
        console.error('Vision API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process image'
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
