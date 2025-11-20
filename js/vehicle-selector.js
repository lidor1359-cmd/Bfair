/**
 * Vehicle Selector Service
 * Use this service to populate cascading dropdowns for car selection
 *
 * Dropdown Flow: Manufacturer -> Model -> Year -> Trim Level
 */

const VehicleSelector = {
    API_BASE: 'https://data.gov.il/api/3/action/datastore_search',
    RESOURCE_ID: '142afde2-6228-49f9-8a29-9b6c3a0cbe40',

    /**
     * Get all manufacturers for first dropdown
     * @returns {Promise<Array>} [{tozeret_cd, tozeret_nm, tozeret_eretz_nm}]
     */
    async getManufacturers() {
        const sql = `SELECT DISTINCT tozeret_cd, tozeret_nm, tozeret_eretz_nm
                     FROM "${this.RESOURCE_ID}"
                     ORDER BY tozeret_nm`;

        const url = `${this.API_BASE}?resource_id=${this.RESOURCE_ID}&sql=${encodeURIComponent(sql)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) throw new Error('Failed to fetch manufacturers');
        return data.result.records;
    },

    /**
     * Get models for a specific manufacturer
     * @param {number} tozeret_cd - Manufacturer code
     * @returns {Promise<Array>} [{degem_cd, kinuy_mishari, degem_nm}]
     */
    async getModelsByManufacturer(tozeret_cd) {
        const sql = `SELECT DISTINCT degem_cd, kinuy_mishari, degem_nm
                     FROM "${this.RESOURCE_ID}"
                     WHERE tozeret_cd = ${tozeret_cd}
                     ORDER BY kinuy_mishari, degem_nm`;

        const url = `${this.API_BASE}?resource_id=${this.RESOURCE_ID}&sql=${encodeURIComponent(sql)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) throw new Error('Failed to fetch models');
        return data.result.records;
    },

    /**
     * Get available years for a specific model
     * @param {number} tozeret_cd - Manufacturer code
     * @param {number} degem_cd - Model code
     * @returns {Promise<Array>} [{shnat_yitzur}]
     */
    async getYearsByModel(tozeret_cd, degem_cd) {
        const sql = `SELECT DISTINCT shnat_yitzur
                     FROM "${this.RESOURCE_ID}"
                     WHERE tozeret_cd = ${tozeret_cd} AND degem_cd = ${degem_cd}
                     ORDER BY shnat_yitzur DESC`;

        const url = `${this.API_BASE}?resource_id=${this.RESOURCE_ID}&sql=${encodeURIComponent(sql)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) throw new Error('Failed to fetch years');
        return data.result.records;
    },

    /**
     * Get trim levels for a specific model and year
     * @param {number} tozeret_cd - Manufacturer code
     * @param {number} degem_cd - Model code
     * @param {number} shnat_yitzur - Year
     * @returns {Promise<Array>} [{ramat_gimur}]
     */
    async getTrimLevels(tozeret_cd, degem_cd, shnat_yitzur) {
        const sql = `SELECT DISTINCT ramat_gimur
                     FROM "${this.RESOURCE_ID}"
                     WHERE tozeret_cd = ${tozeret_cd}
                       AND degem_cd = ${degem_cd}
                       AND shnat_yitzur = ${shnat_yitzur}
                     ORDER BY ramat_gimur`;

        const url = `${this.API_BASE}?resource_id=${this.RESOURCE_ID}&sql=${encodeURIComponent(sql)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) throw new Error('Failed to fetch trim levels');
        return data.result.records;
    },

    /**
     * Get full vehicle specifications
     * @param {number} tozeret_cd - Manufacturer code
     * @param {number} degem_cd - Model code
     * @param {number} shnat_yitzur - Year
     * @param {string} ramat_gimur - Trim level
     * @returns {Promise<Object>} Full vehicle record
     */
    async getVehicleSpecs(tozeret_cd, degem_cd, shnat_yitzur, ramat_gimur) {
        const filters = JSON.stringify({
            tozeret_cd,
            degem_cd,
            shnat_yitzur,
            ramat_gimur
        });

        const url = `${this.API_BASE}?resource_id=${this.RESOURCE_ID}&filters=${encodeURIComponent(filters)}&limit=1`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) throw new Error('Failed to fetch vehicle specs');
        return data.result.records[0] || null;
    },

    /**
     * Search vehicles by commercial name
     * @param {string} query - Search query
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Matching vehicles
     */
    async searchVehicles(query, limit = 20) {
        const url = `${this.API_BASE}?resource_id=${this.RESOURCE_ID}&q=${encodeURIComponent(query)}&limit=${limit}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) throw new Error('Search failed');
        return data.result.records;
    },

    /**
     * Get display name for a vehicle
     * @param {Object} vehicle - Vehicle record
     * @returns {string} Formatted display name
     */
    getDisplayName(vehicle) {
        const name = vehicle.kinuy_mishari || vehicle.degem_nm;
        const trim = vehicle.ramat_gimur ? ` ${vehicle.ramat_gimur}` : '';
        return `${vehicle.tozeret_nm} ${name}${trim} (${vehicle.shnat_yitzur})`;
    },

    /**
     * Format vehicle for sale listing
     * @param {Object} vehicle - Vehicle record
     * @returns {Object} Formatted vehicle data
     */
    formatForListing(vehicle) {
        return {
            // Identification
            manufacturer: vehicle.tozeret_nm,
            manufacturerCode: vehicle.tozeret_cd,
            model: vehicle.kinuy_mishari || vehicle.degem_nm,
            modelCode: vehicle.degem_cd,
            year: vehicle.shnat_yitzur,
            trim: vehicle.ramat_gimur,

            // Specs
            engineSize: vehicle.nefah_manoa,
            horsepower: vehicle.koah_sus,
            fuelType: vehicle.delek_nm,
            transmission: vehicle.automatic_ind ? 'אוטומטי' : 'ידני',
            doors: vehicle.mispar_dlatot,
            seats: vehicle.mispar_moshavim,

            // Safety
            safetyRating: vehicle.nikud_betihut,
            airbags: vehicle.mispar_kariot_avir,

            // Environmental
            pollutionGroup: vehicle.kvutzat_zihum,
            greenIndex: vehicle.madad_yarok,
            co2: vehicle.CO2_WLTP
        };
    }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VehicleSelector;
}
