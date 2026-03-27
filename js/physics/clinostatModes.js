/**
 * @file clinostatModes.js
 * @description Clinostat operating mode controller — manages 1D, 2D, 3D modes
 *              with Constant Speed, Random Walk, and Optimized sub-modes.
 * @version 1.0.0
 * @license Apache-2.0
 * @citations
 *   - [Borst & van Loon, 2009] RPM technology and random walk algorithms
 *   - [Wuest et al., 2015] Optimal rotation strategies for mammalian cells
 */
'use strict';

import { PHYSICS, MODES, CLINOSTAT } from '../utils/constants.js';
import { rpmToRadPerSec } from '../utils/unitConverter.js';
import { Quaternion } from './quaternion.js';
import { gravityFromQuaternion } from './gravityVector.js';

/**
 * Clinostat simulation state
 */
export class ClinostatSimulation {
    constructor() {
        /** Current clinostat mode (1D/2D/3D) */
        this.clinostatMode = MODES.CLINOSTAT_2D;
        /** Current rotation sub-mode */
        this.rotationMode = MODES.ROTATION_CONSTANT;
        /** Current orientation quaternion */
        this.orientation = Quaternion.identity();
        /** Angular velocities [rad/s] per axis */
        this.omega = [0, 0, 0];
        /** RPM setpoints per axis */
        this.rpmSetpoints = [0, 0, 0];
        /** RPM actual per axis */
        this.rpmActual = [0, 0, 0];
        /** Direction per axis (1=CW, -1=CCW) */
        this.directions = [1, -1, 1];
        /** Ramp rate [RPM/s] */
        this.rampRate = CLINOSTAT.DEFAULT_RAMP_RATE;
        /** Simulation time [s] */
        this.time = 0;
        /** Running state */
        this.running = false;
        /** Random walk state */
        this._randomWalkTimer = 0;
        this._randomWalkInterval = 15; // seconds
        this._randomWalkMaxRPM = 10;
    }

    /**
     * Set the clinostat mode
     * @param {'1D'|'2D'|'3D'} mode
     */
    setMode(mode) {
        this.clinostatMode = mode;
        // Reset orientation
        this.orientation = Quaternion.identity();
        this.time = 0;

        // Disable unused axes
        if (mode === MODES.CLINOSTAT_1D) {
            this.rpmSetpoints[1] = 0;
            this.rpmSetpoints[2] = 0;
        } else if (mode === MODES.CLINOSTAT_2D) {
            this.rpmSetpoints[2] = 0;
        }
    }

    /**
     * Set RPM for an axis
     * @param {number} axis - 0, 1, or 2
     * @param {number} rpm - RPM value
     */
    setRPM(axis, rpm) {
        this.rpmSetpoints[axis] = Math.max(0, Math.min(rpm, CLINOSTAT.RPM_MAX));
    }

    /**
     * Set RPM with auto-calculated axis 2 for irrational ratio
     * Uses golden ratio: ω₂ = ω₁ × φ
     *
     * @param {number} rpm1 - Axis 1 RPM
     */
    setRPMWithGoldenRatio(rpm1) {
        this.rpmSetpoints[0] = rpm1;
        this.rpmSetpoints[1] = rpm1 * PHYSICS.PHI;
    }

    /**
     * Check if the ratio of two RPMs is irrational (approximately)
     * Uses continued fraction expansion to check rationality
     *
     * @param {number} rpm1
     * @param {number} rpm2
     * @returns {{isRational: boolean, ratio: number, warning: string}}
     */
    static checkRPMRatio(rpm1, rpm2) {
        if (rpm2 === 0) return { isRational: true, ratio: Infinity, warning: 'Axis 2 is stopped' };
        const ratio = rpm1 / rpm2;

        // Check if ratio is close to a simple fraction
        for (let den = 1; den <= 20; den++) {
            for (let num = 1; num <= 20; num++) {
                if (Math.abs(ratio - num / den) < 0.001) {
                    return {
                        isRational: true,
                        ratio,
                        warning: `RPM ratio ≈ ${num}/${den} — this is a rational ratio. ` +
                                 `Gravity vector will NOT cover the full sphere. ` +
                                 `Use golden ratio (×${PHYSICS.PHI.toFixed(4)}) for irrational ratio.`
                    };
                }
            }
        }
        return { isRational: false, ratio, warning: '' };
    }

    /**
     * Advance the simulation by one physics timestep
     * @param {number} dt - Timestep [s]
     * @returns {Object} Current state snapshot
     */
    step(dt) {
        if (!this.running) return this._getState();

        this.time += dt;

        // Apply ramp to actual RPMs (smooth acceleration)
        for (let i = 0; i < 3; i++) {
            const target = this.rpmSetpoints[i] * this.directions[i];
            const current = this.rpmActual[i];
            const diff = target - current;
            const maxChange = this.rampRate * dt;
            if (Math.abs(diff) <= maxChange) {
                this.rpmActual[i] = target;
            } else {
                this.rpmActual[i] += Math.sign(diff) * maxChange;
            }
        }

        // Handle random walk mode
        if (this.rotationMode === MODES.ROTATION_RANDOM) {
            this._updateRandomWalk(dt);
        }

        // Convert RPM to rad/s for physics
        this.omega[0] = rpmToRadPerSec(Math.abs(this.rpmActual[0])) * Math.sign(this.rpmActual[0]);
        this.omega[1] = rpmToRadPerSec(Math.abs(this.rpmActual[1])) * Math.sign(this.rpmActual[1]);
        this.omega[2] = rpmToRadPerSec(Math.abs(this.rpmActual[2])) * Math.sign(this.rpmActual[2]);

        // Build angular velocity vector based on mode
        let omegaVec;
        switch (this.clinostatMode) {
            case MODES.CLINOSTAT_1D:
                omegaVec = [this.omega[0], 0, 0]; // Rotation about X only
                break;
            case MODES.CLINOSTAT_2D:
                omegaVec = [this.omega[0], this.omega[1], 0]; // X and Y
                break;
            case MODES.CLINOSTAT_3D:
                omegaVec = [this.omega[0], this.omega[1], this.omega[2]]; // X, Y, Z
                break;
            default:
                omegaVec = [0, 0, 0];
        }

        // Integrate orientation quaternion
        this.orientation = this.orientation.integrate(omegaVec, dt);

        return this._getState();
    }

    /**
     * Get current simulation state
     * @returns {Object}
     */
    _getState() {
        const gVec = gravityFromQuaternion(this.orientation);
        const gMag = Math.sqrt(gVec[0] ** 2 + gVec[1] ** 2 + gVec[2] ** 2);

        return {
            time: this.time,
            mode: this.clinostatMode,
            rotationMode: this.rotationMode,
            running: this.running,
            rpmSetpoints: [...this.rpmSetpoints],
            rpmActual: [...this.rpmActual],
            omega: [...this.omega],
            directions: [...this.directions],
            orientation: this.orientation.clone(),
            gravityVector: gVec,
            gravityMagnitude: gMag,
            euler: this.orientation.toEulerZYX()
        };
    }

    /**
     * Random walk mode — periodically randomize axis speeds/directions
     * @param {number} dt
     */
    _updateRandomWalk(dt) {
        this._randomWalkTimer += dt;
        if (this._randomWalkTimer >= this._randomWalkInterval) {
            this._randomWalkTimer = 0;
            const maxRPM = this._randomWalkMaxRPM;
            // Randomize RPM and direction for each active axis
            const numAxes = this.clinostatMode === MODES.CLINOSTAT_3D ? 3 :
                           this.clinostatMode === MODES.CLINOSTAT_2D ? 2 : 1;
            for (let i = 0; i < numAxes; i++) {
                this.rpmSetpoints[i] = Math.random() * maxRPM + 0.5; // 0.5–maxRPM
                this.directions[i] = Math.random() > 0.5 ? 1 : -1;
            }
        }
    }

    /** Start simulation */
    start() {
        this.running = true;
    }

    /** Stop simulation (halt motors) */
    stop() {
        this.running = false;
        this.rpmSetpoints = [0, 0, 0];
    }

    /** Pause (keep RPM, stop advancing) */
    pause() {
        this.running = false;
    }

    /** Reset to initial state */
    reset() {
        this.running = false;
        this.orientation = Quaternion.identity();
        this.omega = [0, 0, 0];
        this.rpmSetpoints = [0, 0, 0];
        this.rpmActual = [0, 0, 0];
        this.time = 0;
        this._randomWalkTimer = 0;
    }

    /** Emergency stop — immediate halt */
    emergencyStop() {
        this.running = false;
        this.rpmActual = [0, 0, 0];
        this.rpmSetpoints = [0, 0, 0];
        this.omega = [0, 0, 0];
    }
}
