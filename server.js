const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.'));
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

    if (!apiKey) {
        throw new Error('GOOGLE_API_KEY not configured');
    }

    const base64Content = imageBuffer.toString('base64');

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: base64Content },
                    features: [
                        { type: 'TEXT_DETECTION', maxResults: 50 },
                        { type: 'DOCUMENT_TEXT_DETECTION' }
                    ],
                    imageContext: {
                        languageHints: ['he', 'en'],
                        textDetectionParams: {
                            enableTextDetectionConfidenceScore: true
                        }
                    }
                }]
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        console.error('Vision API error response:', error);
        throw new Error(`Vision API error: ${error}`);
    }

    const result = await response.json();

    // Check for API errors in response
    if (result.responses?.[0]?.error) {
        throw new Error(`Vision API: ${result.responses[0].error.message}`);
    }

    const textAnnotations = result.responses?.[0]?.textAnnotations || [];
    const fullText = textAnnotations.length > 0 ? textAnnotations[0].description || '' : '';

    console.log('=== OCR FULL TEXT ===');
    console.log(fullText);
    console.log('=== END OCR ===');

    return fullText;
}

// Extract Israeli license plate pattern
function extractLicensePlate(text) {
    console.log('=== Extracting plate from text ===');

    // Find all 8-digit numbers (new format plates)
    const all8digit = [...text.matchAll(/(\d{8})/g)].map(m => ({ num: m[1], index: m.index }));

    // Find all 7-digit numbers (old format plates)
    const all7digit = [...text.matchAll(/(\d{7})/g)].map(m => ({ num: m[1], index: m.index }));

    // Find formatted plates XXX-XX-XXX or XX-XXX-XX
    const formatted = [];
    const fmtMatches = [...text.matchAll(/(\d{2,3})[-–:.\s]+(\d{2,3})[-–:.\s]+(\d{2,3})/g)];
    for (const m of fmtMatches) {
        const plate = m[1] + m[2] + m[3];
        if (plate.length === 7 || plate.length === 8) {
            formatted.push({ num: plate, index: m.index });
        }
    }

    console.log('Formatted plates:', formatted);
    console.log('8-digit numbers:', all8digit);
    console.log('7-digit numbers:', all7digit);

    // Priority: formatted plates > 8-digit > 7-digit
    if (formatted.length > 0) {
        formatted.sort((a, b) => a.index - b.index);
        console.log('Returning formatted:', formatted[0].num);
        return formatted[0].num;
    }

    if (all8digit.length > 0) {
        all8digit.sort((a, b) => a.index - b.index);
        console.log('Returning 8-digit:', all8digit[0].num);
        return all8digit[0].num;
    }

    if (all7digit.length > 0) {
        all7digit.sort((a, b) => a.index - b.index);
        console.log('Returning 7-digit:', all7digit[0].num);
        return all7digit[0].num;
    }

    return null;
}

// Extract license plate from vehicle registration document
function extractFromLicenseDocument(text) {
    console.log('=== Extracting from license document ===');
    console.log('Full text preview:', text.substring(0, 500));

    // In Israeli license documents, the plate number typically appears:
    // 1. At the very beginning of the document (header area)
    // 2. After "מספר רכב" label

    // First try: Look for 8-digit number at the very start of the document
    const startMatch = text.match(/^\s*(\d{8})/);
    if (startMatch) {
        console.log('Found at start of document:', startMatch[1]);
        return startMatch[1];
    }

    // Second try: Find number before "מספר רכב" or near it
    const beforeMispar = text.match(/(\d{8})\s*(?:1M|M1)?\s*.*?מספר\s*רכב/);
    if (beforeMispar) {
        console.log('Found before מספר רכב:', beforeMispar[1]);
        return beforeMispar[1];
    }

    // Third try: Find number after מספר רכב
    const afterMispar = text.match(/מספר\s*רכב[:\s]*(\d{7,8})/);
    if (afterMispar) {
        console.log('Found after מספר רכב:', afterMispar[1]);
        return afterMispar[1];
    }

    // Fourth try: First 8-digit number in the document (most likely the plate)
    const firstEight = text.match(/(\d{8})/);
    if (firstEight) {
        console.log('Found first 8-digit number:', firstEight[1]);
        return firstEight[1];
    }

    // Look for the standard plate extraction
    return extractLicensePlate(text);
}

// License plate extraction endpoint
app.post('/api/extract-plate', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file provided' });
        }

        const uploadType = req.body.type || 'vehicle';
        const isPDF = req.file.mimetype === 'application/pdf';
        console.log('Upload type:', uploadType, 'isPDF:', isPDF);

        let fullText;

        if (isPDF) {
            // Extract text directly from PDF
            const pdfData = await pdfParse(req.file.buffer);
            fullText = pdfData.text;
            console.log('=== PDF TEXT ===');
            console.log(fullText);
            console.log('=== END PDF ===');
        } else {
            // Use Google Vision API for images
            fullText = await extractTextFromImage(req.file.buffer);
        }

        if (!fullText) {
            return res.status(404).json({
                success: false,
                error: uploadType === 'license' ? 'לא זוהה טקסט ברישיון' : 'No text detected in file'
            });
        }

        // Use appropriate extraction based on type
        const licensePlate = uploadType === 'license'
            ? extractFromLicenseDocument(fullText)
            : extractLicensePlate(fullText);

        if (!licensePlate) {
            return res.status(404).json({
                success: false,
                error: uploadType === 'license'
                    ? 'לא זוהה מספר רישוי ברישיון הרכב'
                    : 'No valid license plate found in file',
                detectedText: fullText
            });
        }

        res.json({
            success: true,
            licensePlate,
            detectedText: fullText
        });

    } catch (error) {
        console.error('Processing Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process file'
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
        const OWNERSHIP_HISTORY = 'bb2355dc-9ec7-4f06-9c3f-3344672171da';
        const INACTIVE_VEHICLES = 'f6efe89a-fb3d-43a4-bb61-9bf12a9b9099';
        const SCRAPPED_VEHICLES = '851ecab1-0622-4dbe-a6c7-f950cf82abf9';
        const RECALLS = '36bf1404-0be4-49d2-82dc-2f1ead4a8b93';

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

        // 4. Get ownership history (count hands with details)
        let ownershipCount = 0;
        let lastOwnershipChange = null;
        let ownershipHistory = [];
        const ownershipResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${OWNERSHIP_HISTORY}&filters={"mispar_rechev":${plateNumber}}&sort=baalut_dt asc`
        );
        const ownershipData = await ownershipResponse.json();
        if (ownershipData.success && ownershipData.result.records.length > 0) {
            ownershipCount = ownershipData.result.records.length;
            ownershipHistory = ownershipData.result.records.map((record, index) => {
                let dateStr = null;
                if (record.baalut_dt) {
                    const dtStr = record.baalut_dt.toString();
                    const year = dtStr.substring(0, 4);
                    const month = dtStr.substring(4, 6);
                    dateStr = `${month}/${year}`;
                }
                return {
                    yad: index + 1,
                    sug_baalut: record.baalut,
                    taarich: dateStr
                };
            });
            // Get last change date
            const lastRecord = ownershipData.result.records[ownershipData.result.records.length - 1];
            if (lastRecord.baalut_dt) {
                const dtStr = lastRecord.baalut_dt.toString();
                const year = dtStr.substring(0, 4);
                const month = dtStr.substring(4, 6);
                lastOwnershipChange = `${month}/${year}`;
            }
        }

        // 5. Check if vehicle is inactive (expired license)
        let isInactive = false;
        const inactiveResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${INACTIVE_VEHICLES}&filters={"mispar_rechev":${plateNumber}}&limit=1`
        );
        const inactiveData = await inactiveResponse.json();
        if (inactiveData.success && inactiveData.result.records.length > 0) {
            isInactive = true;
        }

        // 6. Check if vehicle is scrapped
        let isScrapped = false;
        let scrappedDate = null;
        const scrappedResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${SCRAPPED_VEHICLES}&filters={"mispar_rechev":${plateNumber}}&limit=1`
        );
        const scrappedData = await scrappedResponse.json();
        if (scrappedData.success && scrappedData.result.records.length > 0) {
            isScrapped = true;
            scrappedDate = scrappedData.result.records[0].bitul_dt;
        }

        // 7. Get recalls/safety issues
        let recalls = [];
        const recallsResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${RECALLS}&filters={"MISPAR_RECHEV":${plateNumber}}`
        );
        const recallsData = await recallsResponse.json();
        if (recallsData.success && recallsData.result.records.length > 0) {
            recalls = recallsData.result.records.map(r => ({
                recall_id: r.RECALL_ID,
                sug_recall: r.SUG_RECALL,
                sug_takala: r.SUG_TAKALA,
                teur_takala: r.TEUR_TAKALA,
                taarich_pticha: r.TAARICH_PTICHA
            }));
        }

        // Calculate if service is overdue
        let serviceOverdue = false;
        if (vehicle.tokef_dt) {
            const tokefDate = new Date(vehicle.tokef_dt);
            serviceOverdue = tokefDate < new Date();
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

                // WLTP specs - basic
                koah_sus: wltpSpecs?.koah_sus,
                nefah_manoa: wltpSpecs?.nefah_manoa,
                mishkal_kolel: wltpSpecs?.mishkal_kolel,
                mispar_dlatot: wltpSpecs?.mispar_dlatot,
                mispar_moshavim: wltpSpecs?.mispar_moshavim,
                automatic_ind: wltpSpecs?.automatic_ind,
                merkav: wltpSpecs?.merkav,
                madad_yarok: wltpSpecs?.madad_yarok,
                kvutzat_zihum: wltpSpecs?.kvutzat_zihum,
                gova: wltpSpecs?.gova,
                hanaa_nm: wltpSpecs?.hanaa_nm,
                delek_nm: wltpSpecs?.delek_nm,
                tozeret_eretz_nm: wltpSpecs?.tozeret_eretz_nm,

                // Safety features
                abs_ind: wltpSpecs?.abs_ind,
                mispar_kariot_avir: wltpSpecs?.mispar_kariot_avir,
                bakarat_yatzivut_ind: wltpSpecs?.bakarat_yatzivut_ind,
                nikud_betihut: wltpSpecs?.nikud_betihut,
                ramat_eivzur_betihuty: wltpSpecs?.ramat_eivzur_betihuty,

                // Advanced safety systems
                bakarat_stiya_menativ_ind: wltpSpecs?.bakarat_stiya_menativ_ind,
                nitur_merhak_milfanim_ind: wltpSpecs?.nitur_merhak_milfanim_ind,
                zihuy_beshetah_nistar_ind: wltpSpecs?.zihuy_beshetah_nistar_ind,
                bakarat_shyut_adaptivit_ind: wltpSpecs?.bakarat_shyut_adaptivit_ind,
                zihuy_holchey_regel_ind: wltpSpecs?.zihuy_holchey_regel_ind,
                maarechet_ezer_labalam_ind: wltpSpecs?.maarechet_ezer_labalam_ind,
                matzlemat_reverse_ind: wltpSpecs?.matzlemat_reverse_ind,
                teura_automatit_benesiya_kadima_ind: wltpSpecs?.teura_automatit_benesiya_kadima_ind,
                blimat_hirum_lifnei_holhei_regel_ofanaim: wltpSpecs?.blimat_hirum_lifnei_holhei_regel_ofanaim,

                // Emissions
                CO2_WLTP: wltpSpecs?.CO2_WLTP,
                kamut_CO2: wltpSpecs?.kamut_CO2,
                kamut_NOX: wltpSpecs?.kamut_NOX,

                // Additional features
                mazgan_ind: wltpSpecs?.mazgan_ind,
                hege_koah_ind: wltpSpecs?.hege_koah_ind,
                kosher_grira_im_blamim: wltpSpecs?.kosher_grira_im_blamim,
                kosher_grira_bli_blamim: wltpSpecs?.kosher_grira_bli_blamim,

                // Structural changes
                kilometer: structuralChanges?.kilometer_test_aharon,
                shinui_mivne: structuralChanges?.shinui_mivne_ind,
                shinui_tzeva: structuralChanges?.shnui_zeva_ind,
                rishum_rishon: structuralChanges?.rishum_rishon_dt,

                // Ownership history
                mispar_yadayim: ownershipCount,
                shinui_baalut_acharon: lastOwnershipChange,
                historiat_baalut: ownershipHistory,

                // Warnings/Flags
                rechev_lo_pail: isInactive,
                rechev_butal: isScrapped,
                taarich_bitul: scrappedDate,
                tipul_baichor: serviceOverdue,

                // Recalls
                recalls: recalls
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
