/**
 * @file stokes.js
 * @description Stokes settling velocity and sedimentation nullification
 *              condition for biological payload analysis.
 * @version 1.0.0
 * @license Apache-2.0
 * @citations
 *   - [Stokes, 1851] G.G. Stokes, "On the Effect of the Internal Friction
 *     of Fluids on the Motion of Pendulums," Trans. Cambridge Phil. Soc., 1851.
 *   - [Briegleb, 1992] W. Briegleb, "Some qualitative and quantitative aspects
 *     of the fast-rotating clinostat as a research tool," ASGSB Bulletin, 5(2), 1992.
 */
'use strict';

/**
 * Compute Stokes settling velocity for a spherical particle in fluid
 *
 * v_s = (2·r²·(ρ_p - ρ_f)·g) / (9·μ)
 *
 * @param {number} particleRadius - Cell/particle radius [m]
 * @param {number} particleDensity - Particle density [kg/m³]
 * @param {number} fluidDensity - Surrounding fluid density [kg/m³]
 * @param {number} gravity - Effective gravitational acceleration [m/s²]
 * @param {number} viscosity - Dynamic viscosity of fluid [Pa·s]
 * @returns {number} Settling velocity [m/s] (positive = downward)
 */
export function stokesSettlingVelocity(particleRadius, particleDensity, fluidDensity, gravity, viscosity) {
    if (viscosity < 1e-15) return 0;
    return (2 * particleRadius * particleRadius * (particleDensity - fluidDensity) * gravity) / (9 * viscosity);
}

/**
 * Minimum angular velocity for sedimentation nullification
 *
 * Clinostat nullification condition: ω >> (2g) / (π · v_s)
 * Practical: ω_min = (2g) / (π · v_s) with safety factor
 *
 * @param {number} settlingVelocity - Stokes settling velocity [m/s]
 * @param {number} safetyFactor - Multiplier (default 5× for > symbol)
 * @returns {number} Minimum angular velocity [rad/s]
 */
export function minAngularVelocityForNullification(settlingVelocity, safetyFactor = 5) {
    if (Math.abs(settlingVelocity) < 1e-15) return 0;
    const g = 9.80665;
    return safetyFactor * (2 * g) / (Math.PI * Math.abs(settlingVelocity));
}

/**
 * Convert minimum angular velocity to RPM
 * @param {number} omega - Angular velocity [rad/s]
 * @returns {number} RPM
 */
export function omegaToRPM(omega) {
    return omega * 60 / (2 * Math.PI);
}

/**
 * Common biological sample presets for Stokes calculation
 */
export const BIOLOGICAL_PRESETS = Object.freeze({
    'Human Osteocyte': {
        name: 'Human Osteocyte',
        particleRadius: 7.5e-6,      // 7.5 μm
        particleDensity: 1080,        // kg/m³
        fluidDensity: 1007,           // Culture medium DMEM
        viscosity: 0.001,             // ~water at 37°C
    },
    'E. coli': {
        name: 'Escherichia coli',
        particleRadius: 0.5e-6,       // 0.5 μm
        particleDensity: 1100,
        fluidDensity: 1000,
        viscosity: 0.001,
    },
    'Red Blood Cell': {
        name: 'Red Blood Cell (RBC)',
        particleRadius: 3.5e-6,       // 3.5 μm
        particleDensity: 1100,
        fluidDensity: 1025,           // Blood plasma
        viscosity: 0.0012,
    },
    'HeLa Cell': {
        name: 'HeLa Cell',
        particleRadius: 10e-6,        // 10 μm
        particleDensity: 1070,
        fluidDensity: 1007,
        viscosity: 0.001,
    },
    'Yeast': {
        name: 'Saccharomyces cerevisiae',
        particleRadius: 3e-6,         // 3 μm
        particleDensity: 1110,
        fluidDensity: 1010,
        viscosity: 0.001,
    },
    'Arabidopsis Seed': {
        name: 'Arabidopsis thaliana seed',
        particleRadius: 150e-6,       // 150 μm
        particleDensity: 1200,
        fluidDensity: 1000,
        viscosity: 0.001,
    },
    'Protein Crystal': {
        name: 'Lysozyme Crystal',
        particleRadius: 50e-6,        // 50 μm
        particleDensity: 1240,
        fluidDensity: 1050,           // Precipitant solution
        viscosity: 0.0015,
    },
});

/**
 * Perform full Stokes analysis for a given sample
 * @param {Object} sample - Sample from BIOLOGICAL_PRESETS or custom
 * @param {number} gResidual - Current residual gravity [m/s²]
 * @returns {Object} Analysis results
 */
export function analyzeSample(sample, gResidual) {
    const vSettling = stokesSettlingVelocity(
        sample.particleRadius,
        sample.particleDensity,
        sample.fluidDensity,
        gResidual,
        sample.viscosity
    );

    const vSettlingEarth = stokesSettlingVelocity(
        sample.particleRadius,
        sample.particleDensity,
        sample.fluidDensity,
        9.80665,
        sample.viscosity
    );

    const omegaMin = minAngularVelocityForNullification(vSettlingEarth);
    const rpmMin = omegaToRPM(omegaMin);

    return {
        name: sample.name,
        settlingVelocity_ms: vSettling,
        settlingVelocity_um_s: vSettling * 1e6,
        settlingVelocityEarth_ms: vSettlingEarth,
        settlingVelocityEarth_um_s: vSettlingEarth * 1e6,
        minOmega_rads: omegaMin,
        minRPM: rpmMin,
        sedimentationReduction: vSettlingEarth > 0 ? (1 - vSettling / vSettlingEarth) * 100 : 0,
        isNullified: Math.abs(vSettling) < 1e-9,
    };
}
