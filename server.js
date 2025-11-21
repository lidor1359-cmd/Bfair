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
// Focuses on the most prominent plate (appears first in Vision API text)
function extractLicensePlate(text) {
    // Israeli license plate patterns
    const patterns = [
        /(\d{3}[-–]\d{2}[-–]\d{3})/g,           // New: 123-45-678
        /(\d{2}[-–]\d{3}[-–]\d{2})/g,            // Old: 12-345-67
        /(\d{3}\s+\d{2}\s+\d{3})/g,              // With spaces
        /(\d{2}\s+\d{3}\s+\d{2})/g,              // With spaces
    ];

    // Collect ALL valid formatted plates with their positions
    let allPlates = [];

    for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
            const plate = match[1].replace(/[-–\s]/g, '');
            const index = match.index;

            // Skip phone numbers (1-700, 1-800, etc.)
            const precedingText = text.substring(Math.max(0, index - 5), index);
            if (/1[-–\s]*(7|8)\d{2}/.test(precedingText + plate.substring(0, 3))) {
                continue;
            }

            if (plate.length === 7 || plate.length === 8) {
                allPlates.push({ plate, index });
            }
        }
    }

    // Return the plate that appears FIRST in the text (most prominent)
    if (allPlates.length > 0) {
        allPlates.sort((a, b) => a.index - b.index);
        return allPlates[0].plate;
    }

    // Fallback to unformatted patterns
    const fallbackPatterns = [
        /\b(\d{8})\b/g,  // New format plain
        /\b(\d{7})\b/g   // Old format plain
    ];

    for (const pattern of fallbackPatterns) {
        const matches = [...text.matchAll(pattern)];
        if (matches.length > 0) {
            return matches[0][1];
        }
    }

    return null;
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

// Vehicle search endpoint - queries multiple government databases
app.get('/api/vehicle/:plateNumber', async (req, res) => {
    try {
        const plateNumber = req.params.plateNumber.replace(/[-\s]/g, '');

        // Resource IDs for government databases
        const VEHICLE_REGISTRATION = '053cea08-09bc-40ec-8f7a-156f0677aff3';
        const WLTP_SPECS = '142afde2-6228-49f9-8a29-9b6c3a0cbe40';
        const STRUCTURAL_CHANGES = '56063a99-8a3e-4ff4-912e-5966c0279bad';

        // 1. Get basic vehicle info
        const vehicleResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${VEHICLE_REGISTRATION}&filters={"mispar_rechev":${plateNumber}}`
        );
        const vehicleData = await vehicleResponse.json();

        if (!vehicleData.success || vehicleData.result.records.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'לא נמצא רכב עם מספר זה'
            });
        }

        const vehicle = vehicleData.result.records[0];

        // 2. Get WLTP specs using tozeret_cd, degem_cd, and shnat_yitzur
        let wltpSpecs = null;
        if (vehicle.tozeret_cd && vehicle.degem_cd) {
            const wltpResponse = await fetch(
                `https://data.gov.il/api/3/action/datastore_search?resource_id=${WLTP_SPECS}&filters={"tozeret_cd":${vehicle.tozeret_cd},"degem_cd":${vehicle.degem_cd},"shnat_yitzur":${vehicle.shnat_yitzur}}&limit=1`
            );
            const wltpData = await wltpResponse.json();
            if (wltpData.success && wltpData.result.records.length > 0) {
                wltpSpecs = wltpData.result.records[0];
            }
        }

        // 3. Get structural changes (mileage, modifications)
        let structuralChanges = null;
        const structuralResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${STRUCTURAL_CHANGES}&filters={"mispar_rechev":${plateNumber}}`
        );
        const structuralData = await structuralResponse.json();
        if (structuralData.success && structuralData.result.records.length > 0) {
            structuralChanges = structuralData.result.records[0];
        }

        // Combine all data
        res.json({
            success: true,
            data: {
                // Basic info
                mispar_rechev: vehicle.mispar_rechev,
                tozeret_nm: vehicle.tozeret_nm,
                kinuy_mishari: vehicle.kinuy_mishari,
                degem_nm: vehicle.degem_nm,
                shnat_yitzur: vehicle.shnat_yitzur,
                tzeva_rechev: vehicle.tzeva_rechev,
                sug_delek_nm: vehicle.sug_delek_nm,
                baalut: vehicle.baalut,
                ramat_gimur: vehicle.ramat_gimur,
                misgeret: vehicle.misgeret,
                moed_aliya_lakvish: vehicle.moed_aliya_lakvish,
                tokef_dt: vehicle.tokef_dt,

                // Tires
                zmig_kidmi: vehicle.zmig_kidmi,
                zmig_ahori: vehicle.zmig_ahori,

                // WLTP specs
                koah_sus: wltpSpecs?.koah_sus,
                nefah_manoa: wltpSpecs?.nefah_manoa,
                mishkal_kolel: wltpSpecs?.mishkal_kolel,
                mispar_dlatot: wltpSpecs?.mispar_dlatot,
                mispar_moshavim: wltpSpecs?.mispar_moshavim,
                automatic_ind: wltpSpecs?.automatic_ind,
                merkav: wltpSpecs?.merkav,
                madad_yarok: wltpSpecs?.madad_yarok,
                kvutzat_zihum: wltpSpecs?.kvutzat_zihum,

                // Structural changes
                kilometer: structuralChanges?.kilometer_test_aharon,
                shinui_mivne: structuralChanges?.shinui_mivne_ind,
                shinui_tzeva: structuralChanges?.shnui_zeva_ind,
                rishum_rishon: structuralChanges?.rishum_rishon_dt
            }
        });

    } catch (error) {
        console.error('Vehicle search error:', error);
        res.status(500).json({
            success: false,
            error: 'שגיאה בחיפוש רכב'
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
