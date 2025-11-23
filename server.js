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
    console.log('Raw text:', text);

    // Step 1: Clean text - remove common OCR errors from Israeli plates
    // Remove "IL" that appears on plates (often misread as "1L" or "IL" or "1")
    let cleanText = text
        .replace(/\bIL\b/gi, '')           // Remove standalone "IL"
        .replace(/\b1L\b/gi, '')           // Remove "1L" (IL misread)
        .replace(/\bil\b/gi, '')           // Remove lowercase "il"
        .replace(/ישראל/g, '')             // Remove "ישראל"
        .replace(/ISRAEL/gi, '');          // Remove "ISRAEL"

    console.log('Cleaned text:', cleanText);

    // Step 2: Find formatted plates (highest priority - most reliable)
    // Israeli plates: XX-XXX-XX (old 7-digit) or XXX-XX-XXX (new 8-digit)
    const formatted = [];

    // Match plates with various separators (dash, space, dot, colon)
    const fmtMatches = [...cleanText.matchAll(/(\d{2,3})[-–—:.\s]+(\d{2,3})[-–—:.\s]+(\d{2,3})/g)];
    for (const m of fmtMatches) {
        const plate = m[1] + m[2] + m[3];
        if (plate.length === 7 || plate.length === 8) {
            formatted.push({ num: plate, index: m.index, formatted: `${m[1]}-${m[2]}-${m[3]}` });
        }
    }

    console.log('Formatted plates found:', formatted);

    if (formatted.length > 0) {
        // Sort by position - take the first one
        formatted.sort((a, b) => a.index - b.index);
        let plate = formatted[0].num;

        // Check if this is 8-digit starting with 1 (IL prefix issue)
        if (plate.length === 8 && plate.startsWith('1')) {
            plate = plate.substring(1);
            console.log('Formatted plate had IL prefix, returning:', plate);
        } else {
            console.log('Returning formatted plate:', plate);
        }
        return plate;
    }

    // Step 3: Look for continuous digit sequences
    // Find all 7 and 8 digit numbers
    const all8digit = [...cleanText.matchAll(/\b(\d{8})\b/g)].map(m => ({ num: m[1], index: m.index }));
    const all7digit = [...cleanText.matchAll(/\b(\d{7})\b/g)].map(m => ({ num: m[1], index: m.index }));

    console.log('8-digit numbers:', all8digit);
    console.log('7-digit numbers:', all7digit);

    // Step 4: Validate and choose best match
    // Prefer 7-digit if both exist (8-digit starting with 1 is likely IL prefix issue)
    // Real 8-digit plates start with higher digits (5,6,7,8,9)
    if (all7digit.length > 0 && all8digit.length > 0) {
        const first8 = all8digit[0].num;
        const first7 = all7digit[0].num;

        // If 8-digit starts with "1" and ends with the 7-digit, it's IL prefix
        if (first8.startsWith('1') && first8.endsWith(first7)) {
            console.log('Detected IL->1 prefix, returning 7-digit:', first7);
            return first7;
        }
    }

    // Return 8-digit if it exists and doesn't start with 1
    if (all8digit.length > 0) {
        const first8 = all8digit[0].num;
        if (!first8.startsWith('1')) {
            console.log('Returning 8-digit:', first8);
            return first8;
        }
        // If starts with 1, check if it's a real plate or IL issue
        // Real 8-digit plates starting with 1 would be like 10000000+
        // But currently Israeli plates haven't reached that range
        const without1 = first8.substring(1);
        console.log('8-digit starts with 1, returning without prefix:', without1);
        return without1;
    }

    if (all7digit.length > 0) {
        console.log('Returning 7-digit:', all7digit[0].num);
        return all7digit[0].num;
    }

    // Step 5: Last resort - find any sequence that looks like a plate
    const anyNumbers = [...text.matchAll(/(\d{7,8})/g)];
    if (anyNumbers.length > 0) {
        console.log('Last resort, returning:', anyNumbers[0][1]);
        return anyNumbers[0][1];
    }

    return null;
}

// Extract license plate from vehicle registration document
function extractFromLicenseDocument(text) {
    console.log('=== Extracting from license document ===');
    console.log('Full text preview:', text.substring(0, 800));

    // Primary method: Look for number directly after "מספר רכב" or "מספר הרכב"
    // This handles various PDF text extraction patterns

    // Pattern 1: "מספר רכב" followed by number (with possible whitespace/newlines)
    const afterMisparRechev = text.match(/מספר\s*(?:ה)?רכב[\s\n:]*(\d{7,8})(?!-)/);
    if (afterMisparRechev) {
        console.log('Found after מספר רכב:', afterMisparRechev[1]);
        return afterMisparRechev[1];
    }

    // Pattern 2: Number appears before "מספר רכב" on same line (RTL text)
    const beforeMisparRechev = text.match(/(\d{7,8})(?!-)[\s\n]*מספר\s*(?:ה)?רכב/);
    if (beforeMisparRechev) {
        console.log('Found before מספר רכב:', beforeMisparRechev[1]);
        return beforeMisparRechev[1];
    }

    // Pattern 3: Look in the area around "מספר רכב" (within 50 chars)
    const misparRechevMatch = text.match(/(.{0,50})מספר\s*(?:ה)?רכב(.{0,50})/);
    if (misparRechevMatch) {
        const context = misparRechevMatch[1] + misparRechevMatch[2];
        const numberInContext = context.match(/(\d{7,8})(?!-)/);
        if (numberInContext) {
            console.log('Found in context of מספר רכב:', numberInContext[1]);
            return numberInContext[1];
        }
    }

    // Fallback: Find all valid numbers and return the first one
    const allNumbers = text.match(/(\d{7,8})(?!-|\d)/g);
    if (allNumbers && allNumbers.length > 0) {
        console.log('Fallback - first valid number:', allNumbers[0]);
        return allNumbers[0];
    }

    // Last resort: standard plate extraction
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
        const CAR_DEALERS = 'eb74ad8c-ffcd-43bb-949c-2244fc8a8651'; // סוחרי רכב - לשימוש עתידי
        const DISABILITY_BADGES = 'c8b9f9c8-4612-4068-934f-d4acd2e3c06e'; // רכבים עם תו נכה
        const TIRE_TOWING_INFO = '0866573c-40cd-4ca8-91d2-9dd2d7a492e5'; // מידע צמיגים וגרירה
        const PUBLIC_VEHICLES = 'cf29862d-ca25-4691-84f6-1be60dcb4a1e'; // רכב ציבורי
        const SAFETY_DISCOUNT = '83bfb278-7be1-4dab-ae2d-40125a923da1'; // הנחה באגרת רישוי - מערכות בטיחות
        const PERSONAL_IMPORT = '03adc637-b6fe-402b-9937-7c3d3afc9140'; // יבוא אישי
        const MOTORCYCLES = 'bf9df4e2-d90d-4c0a-a400-19e15af8e95f'; // רכב דו גלגלי

        // 1. Get basic vehicle info
        const vehicleResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${VEHICLE_REGISTRATION}&filters={"mispar_rechev":${plateNumber}}`
        );
        const vehicleData = await vehicleResponse.json();

        let vehicle = null;
        let isFromScrappedOnly = false;

        if (!vehicleData.success || vehicleData.result.records.length === 0) {
            // Vehicle not in main registry - check if it's in scrapped vehicles
            const scrappedCheckResponse = await fetch(
                `https://data.gov.il/api/3/action/datastore_search?resource_id=${SCRAPPED_VEHICLES}&filters={"mispar_rechev":${plateNumber}}&limit=1`
            );
            const scrappedCheckData = await scrappedCheckResponse.json();

            if (scrappedCheckData.success && scrappedCheckData.result.records.length > 0) {
                // Vehicle found in scrapped database - use its data
                const scrappedRecord = scrappedCheckData.result.records[0];
                vehicle = {
                    mispar_rechev: scrappedRecord.mispar_rechev,
                    tozeret_nm: scrappedRecord.tozeret_nm,
                    kinuy_mishari: scrappedRecord.kinuy_mishari,
                    degem_nm: scrappedRecord.degem_nm,
                    shnat_yitzur: scrappedRecord.shnat_yitzur,
                    tzeva_rechev: scrappedRecord.tzeva_rechev,
                    sug_delek_nm: scrappedRecord.sug_delek_nm,
                    sug_rechev_nm: scrappedRecord.sug_rechev_nm,
                    baalut: scrappedRecord.baalut,
                    misgeret: scrappedRecord.misgeret,
                    moed_aliya_lakvish: scrappedRecord.moed_aliya_lakvish,
                    mishkal_kolel: scrappedRecord.mishkal_kolel,
                    ramat_gimur: scrappedRecord.ramat_gimur,
                    ramat_eivzur_betihuty: scrappedRecord.ramat_eivzur_betihuty,
                    kvutzat_zihum: scrappedRecord.kvutzat_zihum,
                    zmig_kidmi: scrappedRecord.zmig_kidmi,
                    zmig_ahori: scrappedRecord.zmig_ahori,
                    tozar_manoa: scrappedRecord.tozar_manoa,
                    degem_manoa: scrappedRecord.degem_manoa,
                    mispar_manoa: scrappedRecord.mispar_manoa,
                    horaat_rishum: scrappedRecord.horaat_rishum
                };
                isFromScrappedOnly = true;
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'לא נמצא רכב עם מספר זה'
                });
            }
        } else {
            vehicle = vehicleData.result.records[0];
        }

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

        // 6. Check if vehicle is scrapped (removed from road)
        let isScrapped = isFromScrappedOnly;
        let scrappedInfo = null;

        if (isFromScrappedOnly) {
            // Already checked when vehicle wasn't in main registry - fetch full details
            const scrappedResponse = await fetch(
                `https://data.gov.il/api/3/action/datastore_search?resource_id=${SCRAPPED_VEHICLES}&filters={"mispar_rechev":${plateNumber}}&limit=1`
            );
            const scrappedData = await scrappedResponse.json();
            if (scrappedData.success && scrappedData.result.records.length > 0) {
                const record = scrappedData.result.records[0];
                scrappedInfo = {
                    bitul_dt: record.bitul_dt,
                    moed_aliya_lakvish: record.moed_aliya_lakvish,
                    shnat_yitzur: record.shnat_yitzur,
                    tozeret_nm: record.tozeret_nm,
                    kinuy_mishari: record.kinuy_mishari,
                    degem_nm: record.degem_nm,
                    sug_delek_nm: record.sug_delek_nm,
                    sug_rechev_nm: record.sug_rechev_nm,
                    tzeva_rechev: record.tzeva_rechev,
                    baalut: record.baalut,
                    misgeret: record.misgeret,
                    mishkal_kolel: record.mishkal_kolel,
                    ramat_gimur: record.ramat_gimur,
                    ramat_eivzur_betihuty: record.ramat_eivzur_betihuty,
                    kvutzat_zihum: record.kvutzat_zihum,
                    zmig_kidmi: record.zmig_kidmi,
                    zmig_ahori: record.zmig_ahori,
                    tozar_manoa: record.tozar_manoa,
                    degem_manoa: record.degem_manoa,
                    mispar_manoa: record.mispar_manoa
                };
            }
        } else {
            // Check if active vehicle is also in scrapped database
            const scrappedResponse = await fetch(
                `https://data.gov.il/api/3/action/datastore_search?resource_id=${SCRAPPED_VEHICLES}&filters={"mispar_rechev":${plateNumber}}&limit=1`
            );
            const scrappedData = await scrappedResponse.json();
            if (scrappedData.success && scrappedData.result.records.length > 0) {
                isScrapped = true;
                const record = scrappedData.result.records[0];
                scrappedInfo = {
                    bitul_dt: record.bitul_dt,
                    moed_aliya_lakvish: record.moed_aliya_lakvish,
                    shnat_yitzur: record.shnat_yitzur,
                    tozeret_nm: record.tozeret_nm,
                    kinuy_mishari: record.kinuy_mishari,
                    degem_nm: record.degem_nm,
                    sug_delek_nm: record.sug_delek_nm,
                    sug_rechev_nm: record.sug_rechev_nm,
                    tzeva_rechev: record.tzeva_rechev,
                    baalut: record.baalut,
                    misgeret: record.misgeret,
                    mishkal_kolel: record.mishkal_kolel,
                    ramat_gimur: record.ramat_gimur,
                    ramat_eivzur_betihuty: record.ramat_eivzur_betihuty,
                    kvutzat_zihum: record.kvutzat_zihum,
                    zmig_kidmi: record.zmig_kidmi,
                    zmig_ahori: record.zmig_ahori,
                    tozar_manoa: record.tozar_manoa,
                    degem_manoa: record.degem_manoa,
                    mispar_manoa: record.mispar_manoa
                };
            }
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

        // 8. Check if vehicle has disability badge
        let disabilityBadge = null;
        const disabilityResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${DISABILITY_BADGES}&filters={"MISPAR RECHEV":${plateNumber}}`
        );
        const disabilityData = await disabilityResponse.json();
        if (disabilityData.success && disabilityData.result.records.length > 0) {
            const record = disabilityData.result.records[0];
            disabilityBadge = {
                taarich_hafaka: record['TAARICH HAFAKAT TAG'],
                sug_tav: record['SUG TAV']
            };
        }

        // 9. Get tire and towing info
        let tireTowingInfo = null;
        const tireTowingResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${TIRE_TOWING_INFO}&filters={"mispar_rechev":${plateNumber}}`
        );
        const tireTowingData = await tireTowingResponse.json();
        if (tireTowingData.success && tireTowingData.result.records.length > 0) {
            const record = tireTowingData.result.records[0];
            tireTowingInfo = {
                kod_omes_tzmig_kidmi: record.kod_omes_tzmig_kidmi,
                kod_omes_tzmig_ahori: record.kod_omes_tzmig_ahori,
                kod_mehirut_tzmig_kidmi: record.kod_mehirut_tzmig_kidmi,
                kod_mehirut_tzmig_ahori: record.kod_mehirut_tzmig_ahori,
                grira_nm: record.grira_nm
            };
        }

        // 10. Check if it's a public vehicle (bus, taxi, etc.)
        let publicVehicleInfo = null;
        const publicVehicleResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${PUBLIC_VEHICLES}&filters={"mispar_rechev":${plateNumber}}`
        );
        const publicVehicleData = await publicVehicleResponse.json();
        if (publicVehicleData.success && publicVehicleData.result.records.length > 0) {
            const record = publicVehicleData.result.records[0];
            publicVehicleInfo = {
                sug_rechev_cd: record.sug_rechev_cd,
                sug_rechev_nm: record.sug_rechev_nm,
                sug_rechev_EU_cd: record.sug_rechev_EU_cd,
                sug_rechev_EU_nm: record.sug_rechev_EU_nm,
                mispar_mekomot: record.mispar_mekomot,
                mispar_mekomot_leyd_nahag: record.mispar_mekomot_leyd_nahag,
                bitul_cd: record.bitul_cd,
                bitul_nm: record.bitul_nm,
                bitul_dt: record.bitul_dt
            };
        }

        // 11. Check if eligible for safety systems discount
        let safetyDiscountInfo = null;
        const safetyDiscountResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${SAFETY_DISCOUNT}&filters={"mispar_rechev":${plateNumber}}`
        );
        const safetyDiscountData = await safetyDiscountResponse.json();
        if (safetyDiscountData.success && safetyDiscountData.result.records.length > 0) {
            const record = safetyDiscountData.result.records[0];
            safetyDiscountInfo = {
                eligible: true,
                updated_dt: record.updated_dt
            };
        }

        // 12. Check if it's a personal import vehicle
        let personalImportInfo = null;
        const personalImportResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${PERSONAL_IMPORT}&filters={"mispar_rechev":${plateNumber}}`
        );
        const personalImportData = await personalImportResponse.json();
        if (personalImportData.success && personalImportData.result.records.length > 0) {
            const record = personalImportData.result.records[0];
            personalImportInfo = {
                sug_yevu: record.sug_yevu,
                tozeret_eretz_nm: record.tozeret_eretz_nm,
                shilda: record.shilda,
                nefach_manoa: record.nefach_manoa
            };
        }

        // 13. Check if it's a motorcycle (two-wheeled vehicle)
        let motorcycleInfo = null;
        const motorcycleResponse = await fetch(
            `https://data.gov.il/api/3/action/datastore_search?resource_id=${MOTORCYCLES}&filters={"mispar_rechev":${plateNumber}}`
        );
        const motorcycleData = await motorcycleResponse.json();
        if (motorcycleData.success && motorcycleData.result.records.length > 0) {
            const record = motorcycleData.result.records[0];
            motorcycleInfo = {
                tozeret_nm: record.tozeret_nm,
                tozeret_eretz_nm: record.tozeret_eretz_nm,
                degem_nm: record.degem_nm,
                shnat_yitzur: record.shnat_yitzur,
                sug_delek_nm: record.sug_delek_nm,
                mishkal_kolel: record.mishkal_kolel,
                mida_zmig_kidmi: record.mida_zmig_kidmi,
                mida_zmig_ahori: record.mida_zmig_ahori,
                nefach_manoa: record.nefach_manoa,
                hespek: record.hespek,
                misgeret: record.misgeret,
                sug_rechev_nm: record.sug_rechev_nm,
                baalut: record.baalut,
                mispar_mekomot: record.mispar_mekomot
            };
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
                sug_degem: vehicle.sug_degem,
                shnat_yitzur: vehicle.shnat_yitzur,
                tzeva_rechev: vehicle.tzeva_rechev,
                tzeva_cd: vehicle.tzeva_cd,
                sug_delek_nm: vehicle.sug_delek_nm,
                baalut: vehicle.baalut,
                ramat_gimur: vehicle.ramat_gimur,
                ramat_eivzur_betihuty: vehicle.ramat_eivzur_betihuty,
                kvutzat_zihum: vehicle.kvutzat_zihum,
                misgeret: vehicle.misgeret,
                moed_aliya_lakvish: vehicle.moed_aliya_lakvish,
                tokef_dt: vehicle.tokef_dt,
                mivchan_acharon_dt: vehicle.mivchan_acharon_dt,
                horaat_rishum: vehicle.horaat_rishum,
                degem_manoa: vehicle.degem_manoa,

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
                pirtei_bitul: scrappedInfo,
                tipul_baichor: serviceOverdue,

                // Recalls
                recalls: recalls,

                // Disability badge
                tav_nacheh: disabilityBadge,

                // Tire and towing info
                tire_towing: tireTowingInfo,

                // Public vehicle info (bus, taxi, etc.)
                rechev_tziburi: publicVehicleInfo,

                // Safety systems discount eligibility
                hanacha_betihuty: safetyDiscountInfo,

                // Personal import info
                yevu_ishi: personalImportInfo,

                // Motorcycle info (two-wheeled vehicles)
                ofanoa: motorcycleInfo
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
