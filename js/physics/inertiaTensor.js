/**
 * @file inertiaTensor.js
 * @description Moment of inertia calculations for clinostat frame components.
 * @version 1.0.0
 * @license Apache-2.0
 * @citations
 *   - [Meriam & Kraige, 2012] J.L. Meriam, L.G. Kraige,
 *     "Engineering Mechanics: Dynamics," 7th Ed., Wiley, 2012.
 */
'use strict';

/**
 * Material density database [kg/m³]
 */
export const MATERIALS = Object.freeze({
    'Aluminum 6061': 2700,
    'Aluminum 7075': 2810,
    'Steel 304': 8000,
    'Acrylic (PMMA)': 1190,
    'PLA': 1240,
    'PEEK': 1320,
    'Carbon Fiber': 1600,
    'Titanium Ti-6Al-4V': 4430,
    'Brass': 8500,
    'Nylon': 1150,
});

/**
 * Thin circular ring (torus approximation for clinostat frame)
 * I_axis = m · R²  (about axis through center, perpendicular to ring plane)
 * I_diameter = (1/2) · m · R²  (about a diameter)
 *
 * @param {number} mass - Mass [kg]
 * @param {number} radius - Mean radius of ring [m]
 * @returns {{axial: number, diametral: number}}
 */
export function momentOfInertiaRing(mass, radius) {
    return {
        axial: mass * radius * radius,
        diametral: 0.5 * mass * radius * radius
    };
}

/**
 * Hollow cylinder (thick ring / annular frame)
 * I = (1/2) · m · (R_outer² + R_inner²)
 *
 * @param {number} mass - Mass [kg]
 * @param {number} rOuter - Outer radius [m]
 * @param {number} rInner - Inner radius [m]
 * @returns {number} Moment of inertia [kg·m²]
 */
export function momentOfInertiaHollowCylinder(mass, rOuter, rInner) {
    return 0.5 * mass * (rOuter * rOuter + rInner * rInner);
}

/**
 * Solid cylinder (motor shaft)
 * I = (1/2) · m · R²
 *
 * @param {number} mass - Mass [kg]
 * @param {number} radius - Radius [m]
 * @returns {number} Moment of inertia [kg·m²]
 */
export function momentOfInertiaSolidCylinder(mass, radius) {
    return 0.5 * mass * radius * radius;
}

/**
 * Solid sphere (spherical payload chamber)
 * I = (2/5) · m · R²
 *
 * @param {number} mass - Mass [kg]
 * @param {number} radius - Radius [m]
 * @returns {number} Moment of inertia [kg·m²]
 */
export function momentOfInertiaSolidSphere(mass, radius) {
    return 0.4 * mass * radius * radius;
}

/**
 * Parallel axis theorem
 * I = I_cm + m · d²
 *
 * @param {number} iCm - Moment of inertia about center of mass [kg·m²]
 * @param {number} mass - Mass [kg]
 * @param {number} distance - Distance from CM to new axis [m]
 * @returns {number} Moment of inertia about new axis [kg·m²]
 */
export function parallelAxisTheorem(iCm, mass, distance) {
    return iCm + mass * distance * distance;
}

/**
 * Compute mass of a torus (clinostat frame ring)
 * V = 2π² · R · r²
 * m = ρ · V
 *
 * @param {number} majorRadius - Distance from center of torus to center of tube [m]
 * @param {number} tubeRadius - Radius of the tube cross-section [m]
 * @param {string} material - Material name from MATERIALS database
 * @returns {{mass: number, volume: number}}
 */
export function torusProperties(majorRadius, tubeRadius, material) {
    const density = MATERIALS[material] || 2700; // default aluminum
    const volume = 2 * Math.PI * Math.PI * majorRadius * tubeRadius * tubeRadius;
    return {
        mass: density * volume,
        volume
    };
}

/**
 * Compute mass of a cylinder (payload chamber)
 * V = π · r² · h
 *
 * @param {number} radius - Radius [m]
 * @param {number} height - Height [m]
 * @param {number} density - Material density [kg/m³]
 * @returns {{mass: number, volume: number}}
 */
export function cylinderProperties(radius, height, density) {
    const volume = Math.PI * radius * radius * height;
    return {
        mass: density * volume,
        volume
    };
}

/**
 * Compute total system inertia for a clinostat configuration
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.frame1 - Inner frame {majorRadius, tubeRadius, material}
 * @param {Object} [config.frame2] - Middle frame (2D/3D only)
 * @param {Object} [config.frame3] - Outer frame (3D only)
 * @param {Object} config.payload - Payload {mass, radius, offset}
 * @param {number} config.motorRotorInertia - Motor rotor inertia [kg·m²]
 * @returns {{totalInertia: number, frameMasses: number[], totalMass: number}}
 */
export function computeSystemInertia(config) {
    let totalInertia = 0;
    let totalMass = 0;
    const frameMasses = [];

    // Frame 1 (inner)
    if (config.frame1) {
        const props = torusProperties(config.frame1.majorRadius, config.frame1.tubeRadius, config.frame1.material);
        const moi = momentOfInertiaRing(props.mass, config.frame1.majorRadius);
        totalInertia += moi.axial;
        totalMass += props.mass;
        frameMasses.push(props.mass);
    }

    // Frame 2 (middle, for 2D/3D)
    if (config.frame2) {
        const props = torusProperties(config.frame2.majorRadius, config.frame2.tubeRadius, config.frame2.material);
        const moi = momentOfInertiaRing(props.mass, config.frame2.majorRadius);
        totalInertia += moi.axial;
        totalMass += props.mass;
        frameMasses.push(props.mass);
    }

    // Frame 3 (outer, for 3D)
    if (config.frame3) {
        const props = torusProperties(config.frame3.majorRadius, config.frame3.tubeRadius, config.frame3.material);
        const moi = momentOfInertiaRing(props.mass, config.frame3.majorRadius);
        totalInertia += moi.axial;
        totalMass += props.mass;
        frameMasses.push(props.mass);
    }

    // Payload
    if (config.payload) {
        const payloadInertia = momentOfInertiaSolidSphere(config.payload.mass, config.payload.radius);
        const offset = config.payload.offset || 0;
        totalInertia += parallelAxisTheorem(payloadInertia, config.payload.mass, offset);
        totalMass += config.payload.mass;
    }

    // Motor rotor
    if (config.motorRotorInertia) {
        totalInertia += config.motorRotorInertia;
    }

    return { totalInertia, frameMasses, totalMass };
}

/**
 * Compute angular acceleration from torque
 * α = τ / I
 *
 * @param {number} torque - Applied torque [N·m]
 * @param {number} inertia - Moment of inertia [kg·m²]
 * @returns {number} Angular acceleration [rad/s²]
 */
export function angularAcceleration(torque, inertia) {
    if (inertia < 1e-10) return 0;
    return torque / inertia;
}

/**
 * Natural frequency of the rotating frame structure
 * f_n = (1/2π) · √(k/m)
 *
 * @param {number} stiffness - Frame stiffness [N/m]
 * @param {number} mass - Effective mass [kg]
 * @returns {number} Natural frequency [Hz]
 */
export function naturalFrequency(stiffness, mass) {
    if (mass < 1e-10) return 0;
    return (1 / (2 * Math.PI)) * Math.sqrt(stiffness / mass);
}

/**
 * Imbalance force
 * F_imb = m_imb · e · ω²
 *
 * @param {number} imbalanceMass - Imbalance mass [kg]
 * @param {number} eccentricity - Eccentricity (distance from axis) [m]
 * @param {number} omega - Angular velocity [rad/s]
 * @returns {number} Imbalance force [N]
 */
export function imbalanceForce(imbalanceMass, eccentricity, omega) {
    return imbalanceMass * eccentricity * omega * omega;
}
