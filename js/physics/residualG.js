/**
 * @file residualG.js
 * @description Time-averaged residual gravity calculator with running integrator.
 *              Computes quality metrics for microgravity simulation fidelity.
 * @version 1.0.0
 * @license Apache-2.0
 * @citations
 *   - [Borst & van Loon, 2009] A.G. Borst, J.J.W.A. van Loon,
 *     "Technology and Developments for the Random Positioning Machine, RPM,"
 *     Microgravity Sci. Technol., 21(4), pp. 287-292, 2009.
 *   - [Wuest et al., 2015] S.L. Wuest et al.,
 *     "Simulated Microgravity: Critical Review on the Use of Random Positioning
 *     Machines for Mammalian Cell Culture," BioMed Research International, 2015.
 */
'use strict';

import { PHYSICS, QUALITY_THRESHOLDS } from '../utils/constants.js';

/**
 * Running residual gravity integrator
 * Maintains cumulative sums of gravity components for efficient time-average computation.
 *
 * g_res = √[(1/T·∫gx dt)² + (1/T·∫gy dt)² + (1/T·∫gz dt)²]
 */
export class ResidualGravityTracker {
    constructor() {
        this.reset();
    }

    /** Reset the integrator */
    reset() {
        /** Cumulative sum of gx [m/s² · s] */
        this.sumGx = 0;
        /** Cumulative sum of gy [m/s² · s] */
        this.sumGy = 0;
        /** Cumulative sum of gz [m/s² · s] */
        this.sumGz = 0;
        /** Total elapsed time [s] */
        this.totalTime = 0;
        /** Number of samples accumulated */
        this.sampleCount = 0;
        /** History for windowed calculation */
        this.history = [];
        /** Max history length for windowed mode */
        this.maxHistoryLength = 60000; // 60s at 1kHz
    }

    /**
     * Add a gravity vector sample to the integrator
     * Uses trapezoidal integration: ∫g dt ≈ Σ g(t) · dt
     *
     * @param {number[]} gVec - Gravity vector [gx, gy, gz] in m/s²
     * @param {number} dt - Timestep [s]
     */
    addSample(gVec, dt) {
        this.sumGx += gVec[0] * dt;
        this.sumGy += gVec[1] * dt;
        this.sumGz += gVec[2] * dt;
        this.totalTime += dt;
        this.sampleCount++;

        // Store for windowed analysis
        if (this.history.length >= this.maxHistoryLength) {
            this.history.shift();
        }
        this.history.push({ gx: gVec[0], gy: gVec[1], gz: gVec[2], dt });
    }

    /**
     * Get the current time-averaged residual gravity magnitude
     *
     * g_res = √[(Σgx·dt/T)² + (Σgy·dt/T)² + (Σgz·dt/T)²]
     *
     * @returns {number} Residual gravity in m/s²
     */
    getResidualG() {
        if (this.totalTime < 1e-10) return PHYSICS.G0; // No data yet
        const avgGx = this.sumGx / this.totalTime;
        const avgGy = this.sumGy / this.totalTime;
        const avgGz = this.sumGz / this.totalTime;
        return Math.sqrt(avgGx * avgGx + avgGy * avgGy + avgGz * avgGz);
    }

    /**
     * Get residual gravity as fraction of Earth gravity
     * @returns {number} g_res / g₀ (dimensionless)
     */
    getResidualGFraction() {
        return this.getResidualG() / PHYSICS.G0;
    }

    /**
     * Get residual gravity as percentage
     * @returns {number} (g_res / g₀) × 100
     */
    getResidualGPercent() {
        return this.getResidualGFraction() * 100;
    }

    /**
     * Get time-averaged gravity vector components
     * @returns {{x: number, y: number, z: number}} Average g in m/s²
     */
    getAverageGVector() {
        if (this.totalTime < 1e-10) return { x: 0, y: 0, z: -PHYSICS.G0 };
        return {
            x: this.sumGx / this.totalTime,
            y: this.sumGy / this.totalTime,
            z: this.sumGz / this.totalTime
        };
    }

    /**
     * Classify the current simulation quality
     * @returns {'EXCELLENT'|'GOOD'|'FAIR'|'POOR'|'NO_DATA'}
     */
    getQuality() {
        if (this.sampleCount < 10) return 'NO_DATA';
        const frac = this.getResidualGFraction();
        if (frac < QUALITY_THRESHOLDS.G_RES_EXCELLENT) return 'EXCELLENT';
        if (frac < QUALITY_THRESHOLDS.G_RES_GOOD) return 'GOOD';
        if (frac < 0.05) return 'FAIR';
        return 'POOR';
    }

    /**
     * Get quality color for UI display
     * @returns {string} CSS color hex
     */
    getQualityColor() {
        const q = this.getQuality();
        switch (q) {
            case 'EXCELLENT': return '#00FF88';
            case 'GOOD': return '#00D4FF';
            case 'FAIR': return '#FFB300';
            case 'POOR': return '#FF3B3B';
            default: return '#666666';
        }
    }

    /**
     * Compute windowed residual g over last N seconds
     * @param {number} windowSeconds - Window duration [s]
     * @returns {number} Windowed residual g in m/s²
     */
    getWindowedResidualG(windowSeconds) {
        let sumX = 0, sumY = 0, sumZ = 0, totalT = 0;
        // Iterate from end of history
        for (let i = this.history.length - 1; i >= 0 && totalT < windowSeconds; i--) {
            const s = this.history[i];
            sumX += s.gx * s.dt;
            sumY += s.gy * s.dt;
            sumZ += s.gz * s.dt;
            totalT += s.dt;
        }
        if (totalT < 1e-10) return PHYSICS.G0;
        const avgX = sumX / totalT;
        const avgY = sumY / totalT;
        const avgZ = sumZ / totalT;
        return Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);
    }

    /**
     * Get statistics for the session
     * @returns {Object} Stats object with min, max, mean, std
     */
    getStatistics() {
        if (this.history.length === 0) return null;
        const magnitudes = this.history.map(s =>
            Math.sqrt(s.gx * s.gx + s.gy * s.gy + s.gz * s.gz)
        );
        const n = magnitudes.length;
        const mean = magnitudes.reduce((a, b) => a + b, 0) / n;
        const min = Math.min(...magnitudes);
        const max = Math.max(...magnitudes);
        const variance = magnitudes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
        return {
            mean_g: mean,
            min_g: min,
            max_g: max,
            std_g: Math.sqrt(variance),
            samples: n,
            duration_s: this.totalTime,
            residual_g: this.getResidualG(),
            quality: this.getQuality()
        };
    }
}

/**
 * One-shot residual gravity calculation from a time series
 * @param {Array<{gx: number, gy: number, gz: number, dt: number}>} series
 * @returns {number} Residual g in m/s²
 */
export function computeResidualG(series) {
    let sumX = 0, sumY = 0, sumZ = 0, totalT = 0;
    for (const s of series) {
        sumX += s.gx * s.dt;
        sumY += s.gy * s.dt;
        sumZ += s.gz * s.dt;
        totalT += s.dt;
    }
    if (totalT < 1e-10) return PHYSICS.G0;
    const avgX = sumX / totalT;
    const avgY = sumY / totalT;
    const avgZ = sumZ / totalT;
    return Math.sqrt(avgX * avgX + avgY * avgY + avgZ * avgZ);
}
