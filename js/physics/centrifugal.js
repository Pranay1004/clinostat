/**
 * @file centrifugal.js
 * @description Centrifugal acceleration, Coriolis force, and total disturbing
 *              acceleration at off-center sample positions.
 * @version 1.0.0
 * @license Apache-2.0
 * @citations
 *   - [Herranz et al., 2013] R. Herranz et al., "Ground-Based Facilities
 *     for Simulation of Microgravity," Astrobiology, 13(1), pp. 1-17, 2013.
 *   - [Wuest et al., 2017] S.L. Wuest et al., "A Novel Microgravity
 *     Simulator Applicable for Three-Dimensional Cell Culturing,"
 *     Microgravity Sci. Technol., 26(2), pp. 77-88, 2014.
 */
'use strict';

/**
 * Compute centrifugal acceleration magnitude at a given radius
 * a_c = ω² · r
 *
 * @param {number} omega - Angular velocity [rad/s]
 * @param {number} r - Distance from rotation center to sample [m]
 * @returns {number} Centrifugal acceleration [m/s²]
 */
export function centrifugalAcceleration(omega, r) {
    return omega * omega * r;
}

/**
 * Compute centrifugal acceleration vector
 * a⃗_c = -ω⃗ × (ω⃗ × r⃗) = ω²r⃗_⊥
 *
 * @param {number[]} omega - Angular velocity vector [ωx, ωy, ωz] [rad/s]
 * @param {number[]} r - Position vector from rotation center [rx, ry, rz] [m]
 * @returns {number[]} Centrifugal acceleration vector [m/s²]
 */
export function centrifugalVector(omega, r) {
    // ω × r
    const wxr = [
        omega[1] * r[2] - omega[2] * r[1],
        omega[2] * r[0] - omega[0] * r[2],
        omega[0] * r[1] - omega[1] * r[0]
    ];
    // -ω × (ω × r) = centrifugal (outward in rotating frame)
    return [
        -(omega[1] * wxr[2] - omega[2] * wxr[1]),
        -(omega[2] * wxr[0] - omega[0] * wxr[2]),
        -(omega[0] * wxr[1] - omega[1] * wxr[0])
    ];
}

/**
 * Compute Coriolis acceleration vector
 * a⃗_cor = -2ω⃗ × v⃗
 *
 * @param {number[]} omega - Angular velocity vector [rad/s]
 * @param {number[]} velocity - Sample velocity in rotating frame [m/s]
 * @returns {number[]} Coriolis acceleration vector [m/s²]
 */
export function coriolisAcceleration(omega, velocity) {
    return [
        -2 * (omega[1] * velocity[2] - omega[2] * velocity[1]),
        -2 * (omega[2] * velocity[0] - omega[0] * velocity[2]),
        -2 * (omega[0] * velocity[1] - omega[1] * velocity[0])
    ];
}

/**
 * Compute Euler (angular acceleration) force
 * a⃗_euler = -α⃗ × r⃗
 *
 * @param {number[]} alpha - Angular acceleration vector [rad/s²]
 * @param {number[]} r - Position vector [m]
 * @returns {number[]} Euler acceleration vector [m/s²]
 */
export function eulerAcceleration(alpha, r) {
    return [
        -(alpha[1] * r[2] - alpha[2] * r[1]),
        -(alpha[2] * r[0] - alpha[0] * r[2]),
        -(alpha[0] * r[1] - alpha[1] * r[0])
    ];
}

/**
 * Compute total disturbing acceleration at a sample position
 * Includes centrifugal + Coriolis + Euler contributions
 *
 * a_total = √(g_res² + a_centrifugal² + a_coriolis² + a_euler²)
 *
 * @param {number} gResidual - Residual gravity [m/s²]
 * @param {number[]} omega - Angular velocity vector [rad/s]
 * @param {number[]} r - Sample position from rotation center [m]
 * @param {number[]} [velocity=[0,0,0]] - Sample velocity in rotating frame [m/s]
 * @param {number[]} [alpha=[0,0,0]] - Angular acceleration [rad/s²]
 * @returns {{total: number, centrifugal: number, coriolis: number, euler: number}}
 */
export function totalDisturbingAcceleration(gResidual, omega, r, velocity = [0,0,0], alpha = [0,0,0]) {
    const aCent = centrifugalVector(omega, r);
    const aCor = coriolisAcceleration(omega, velocity);
    const aEul = eulerAcceleration(alpha, r);

    const centMag = vecMag(aCent);
    const corMag = vecMag(aCor);
    const eulMag = vecMag(aEul);

    const total = Math.sqrt(
        gResidual * gResidual +
        centMag * centMag +
        corMag * corMag +
        eulMag * eulMag
    );

    return {
        total,
        centrifugal: centMag,
        coriolis: corMag,
        euler: eulMag
    };
}

/**
 * Compute the maximum centrifugal acceleration across the payload volume
 * Given a payload radius, finds the worst-case centrifugal acceleration
 *
 * @param {number} omega - Angular velocity magnitude [rad/s]
 * @param {number} payloadRadius - Payload chamber radius [m]
 * @returns {number} Maximum centrifugal acceleration [m/s²]
 */
export function maxCentrifugalInPayload(omega, payloadRadius) {
    return omega * omega * payloadRadius;
}

/**
 * Check if centrifugal acceleration is below acceptable threshold
 * Rule of thumb: a_c < 0.001g for good simulation quality
 *
 * @param {number} omega - Angular velocity [rad/s]
 * @param {number} r - Sample distance from center [m]
 * @param {number} threshold - Acceptable threshold in g-fraction (default 0.001)
 * @returns {{acceptable: boolean, aCentrifugal: number, ratio: number}}
 */
export function checkCentrifugalLimit(omega, r, threshold = 0.001) {
    const aC = centrifugalAcceleration(omega, r);
    const ratio = aC / 9.80665;
    return {
        acceptable: ratio < threshold,
        aCentrifugal: aC,
        ratio
    };
}

/** Vector magnitude helper */
function vecMag(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}
