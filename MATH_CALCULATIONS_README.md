# ClinoSim Pro — Mathematics & Calculations Reference

**Version:** 1.0 | **Last Revised:** 2026-03-24

---

## 1. Quaternion Rotation

**Formula ID:** MATH-001  
**Name:** Quaternion from axis-angle  
$$q = \cos(\theta/2) + \sin(\theta/2)(n_x \mathbf{i} + n_y \mathbf{j} + n_z \mathbf{k})$$

**Variables:** θ = rotation angle [rad], (nx, ny, nz) = unit rotation axis  
**Used In:** `quaternion.js → Quat.fromAxisAngle()`  
**Citation:** [CITE-001] Hamilton (1843), [CITE-002] Kuipers (1999)

---

**Formula ID:** MATH-002  
**Name:** Hamilton product (quaternion multiplication)  
$$q_1 \otimes q_2 = (w_1w_2 - \vec{v_1}\cdot\vec{v_2},\ w_1\vec{v_2} + w_2\vec{v_1} + \vec{v_1}\times\vec{v_2})$$

**Used In:** `quaternion.js → Quat.mul()`  
**Citation:** [CITE-001]

---

**Formula ID:** MATH-003  
**Name:** Vector rotation by quaternion  
$$\vec{v'} = q \otimes [0,\vec{v}] \otimes q^* = \vec{v} + 2w(\vec{q}\times\vec{v}) + 2(\vec{q}\times(\vec{q}\times\vec{v}))$$

**Used In:** `quaternion.js → Quat.rotVec()`  
**Citation:** [CITE-002]

---

**Formula ID:** MATH-004  
**Name:** Quaternion integration  
$$q(t+\Delta t) = q(t) + \frac{\Delta t}{2} [0, \omega_x, \omega_y, \omega_z] \otimes q(t)$$
Then renormalize: $q \leftarrow q / |q|$

**Used In:** `quaternion.js → Quat.integrate()`, `app.js → physicsStep()`  
**Citation:** [CITE-002], [CITE-003] Shoemake (1985)

---

## 2. Gravity Vector in Rotating Frame

**Formula ID:** MATH-005  
**Name:** 1D clinostat gravity vector  
$$\vec{g}(t) = [0,\ g_0 \sin(\omega t),\ -g_0 \cos(\omega t)]$$

**Variables:** ω = angular velocity [rad/s], g₀ = 9.80665 m/s²  
**Used In:** `gravityVector.js → gravity1D()`  
**Citation:** [CITE-004] Briegleb (1992)

---

**Formula ID:** MATH-006  
**Name:** 2D clinostat gravity vector  
$$\vec{g}(t) = [R_y(\omega_2 t) \cdot R_x(\omega_1 t)]^{-1} \cdot [0, 0, -g_0]$$

Using quaternions: $\vec{g}_{sample} = q_{total}^* \otimes \vec{g}_{lab} \otimes q_{total}$  
where $q_{total} = q_2 \otimes q_1$

**Variables:** ω₁ = inner angular velocity, ω₂ = outer angular velocity  
**Used In:** `gravityVector.js → gravity2D()`, `app.js → physicsStep()`  
**Citation:** [CITE-005] Borst & van Loon (2009)

---

**Formula ID:** MATH-007  
**Name:** Irrational speed ratio (Golden ratio)  
$$\omega_2 = \omega_1 \times \varphi = \omega_1 \times \frac{1+\sqrt{5}}{2} \approx \omega_1 \times 1.6180$$

Ensures gravity vector trajectory covers the full sphere without repeating.

**Used In:** `app.js → STATE.autoGolden`  
**Citation:** [CITE-005]

---

## 3. Residual Gravity

**Formula ID:** MATH-008  
**Name:** Time-averaged residual gravity  
$$g_{res} = \left\| \frac{1}{T} \int_0^T \vec{g}(t)\ dt \right\| = \sqrt{\left(\frac{\sum g_x \Delta t}{T}\right)^2 + \left(\frac{\sum g_y \Delta t}{T}\right)^2 + \left(\frac{\sum g_z \Delta t}{T}\right)^2}$$

**Quality metric:** $g_{res\%} = \frac{g_{res}}{g_0} \times 100$

| Quality    | Threshold         |
|------------|-------------------|
| EXCELLENT  | < 0.1% (0.001g)   |
| GOOD       | < 1% (0.01g)      |
| FAIR       | < 5% (0.05g)      |
| POOR       | ≥ 5%              |

**Used In:** `residualG.js`, `app.js → physicsStep()`  
**Citation:** [CITE-005], [CITE-006] van Loon (2007)

---

## 4. Centrifugal Acceleration

**Formula ID:** MATH-009  
**Name:** Centrifugal acceleration magnitude  
$$a_c = \omega^2 \cdot r$$

**Formula ID:** MATH-010  
**Name:** Centrifugal acceleration vector  
$$\vec{a}_c = -\vec{\omega} \times (\vec{\omega} \times \vec{r})$$

**Used In:** `centrifugal.js`, `app.js → updateReadouts()`  
**Citation:** [CITE-007] Herranz et al. (2013)

---

## 5. Coriolis Acceleration

**Formula ID:** MATH-011  
$$\vec{a}_{cor} = -2\vec{\omega} \times \vec{v}$$

**Used In:** `centrifugal.js → coriolisAcceleration()`  
**Citation:** [CITE-007]

---

## 6. Stokes Settling Velocity

**Formula ID:** MATH-012  
$$v_s = \frac{2 r^2 (\rho_p - \rho_f) g}{9 \mu}$$

**Variables:** r = particle radius [m], ρ_p = particle density, ρ_f = fluid density [kg/m³], μ = dynamic viscosity [Pa·s]  

**Formula ID:** MATH-013  
**Name:** Sedimentation nullification condition  
$$\omega \gg \frac{2g}{\pi \cdot v_s}$$

**Used In:** `stokes.js`, `app.js → updateStokesAnalysis()`  
**Citation:** [CITE-008] Stokes (1851), [CITE-004] Briegleb (1992)

---

## 7. Moment of Inertia

**Formula ID:** MATH-014  
**Name:** Hollow cylinder / ring  
$$I = \frac{1}{2} m (R_{outer}^2 + R_{inner}^2)$$

**Formula ID:** MATH-015  
**Name:** Thin ring  
$$I_{axial} = mR^2, \quad I_{diametral} = \frac{1}{2}mR^2$$

**Formula ID:** MATH-016  
**Name:** Torus volume  
$$V = 2\pi^2 R r^2$$

where R = major radius, r = tube radius

**Formula ID:** MATH-017  
**Name:** Parallel axis theorem  
$$I = I_{CM} + md^2$$

**Used In:** `inertiaTensor.js`, `app.js → updateMassInertia()`  
**Citation:** [CITE-009] Meriam & Kraige (2012)

---

## 8. PID Motor Control

**Formula ID:** MATH-018  
$$u(t) = K_p e(t) + K_i \int_0^t e(\tau) d\tau + K_d \frac{de}{dt}$$

**Variables:** e(t) = ω_setpoint − ω_actual  
**Anti-windup:** Clamp integral to [−I_max, +I_max]  
**Used In:** `clinostatModes.js` (ramp control approximation in app.js)  
**Citation:** [CITE-010] Åström & Hägglund (1995)

---

## 9. RPM ↔ rad/s Conversion

**Formula ID:** MATH-019  
$$\omega = \text{RPM} \times \frac{2\pi}{60}$$

**Used In:** `unitConverter.js → rpmToRadPerSec()`, `app.js`  

---

## 10. Euler Angles from Quaternion (Display Only)

**Formula ID:** MATH-020  
$$\text{roll} = \arctan2(2(qw \cdot qx + qy \cdot qz),\ 1-2(qx^2+qy^2))$$
$$\text{pitch} = \arcsin(2(qw \cdot qy - qz \cdot qx))$$
$$\text{yaw} = \arctan2(2(qw \cdot qz + qx \cdot qy),\ 1-2(qy^2+qz^2))$$

⚠ **WARNING:** Euler angles suffer from gimbal lock at pitch = ±90°. Used for display only — all internal computations use quaternions.

**Used In:** `quaternion.js → Quat.toEuler()`, `app.js → updateReadouts()`  
**Citation:** [CITE-011] Diebel (2006)
