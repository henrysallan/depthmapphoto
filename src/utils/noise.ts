// Simple 3D Perlin-like noise implementation
export class PerlinNoise {
  private permutation: number[]

  constructor(seed = 0) {
    // Create permutation table
    this.permutation = []
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i
    }
    
    // Shuffle based on seed
    const random = this.seededRandom(seed)
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]]
    }
    
    // Extend permutation
    this.permutation = [...this.permutation, ...this.permutation]
  }

  private seededRandom(seed: number) {
    let state = seed
    return () => {
      state = (state * 9301 + 49297) % 233280
      return state / 233280
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a)
  }

  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }

  noise(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const Z = Math.floor(z) & 255

    x -= Math.floor(x)
    y -= Math.floor(y)
    z -= Math.floor(z)

    const u = this.fade(x)
    const v = this.fade(y)
    const w = this.fade(z)

    const A = this.permutation[X] + Y
    const AA = this.permutation[A] + Z
    const AB = this.permutation[A + 1] + Z
    const B = this.permutation[X + 1] + Y
    const BA = this.permutation[B] + Z
    const BB = this.permutation[B + 1] + Z

    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(u, this.grad(this.permutation[AA], x, y, z), this.grad(this.permutation[BA], x - 1, y, z)),
        this.lerp(u, this.grad(this.permutation[AB], x, y - 1, z), this.grad(this.permutation[BB], x - 1, y - 1, z))
      ),
      this.lerp(
        v,
        this.lerp(u, this.grad(this.permutation[AA + 1], x, y, z - 1), this.grad(this.permutation[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.permutation[AB + 1], x, y - 1, z - 1), this.grad(this.permutation[BB + 1], x - 1, y - 1, z - 1))
      )
    )
  }
}

// Curl noise - generates divergence-free flow field
export class CurlNoise {
  private perlin: PerlinNoise

  constructor(seed = 0) {
    this.perlin = new PerlinNoise(seed)
  }

  // Calculate curl of a potential field
  curl(x: number, y: number, z: number, epsilon = 0.0001): { x: number; y: number; z: number } {
    // Sample potential field around the point
    const dx = epsilon
    const dy = epsilon
    const dz = epsilon

    // Get partial derivatives
    const p_dx = this.potential(x + dx, y, z)
    const n_dx = this.potential(x - dx, y, z)
    const p_dy = this.potential(x, y + dy, z)
    const n_dy = this.potential(x, y - dy, z)
    const p_dz = this.potential(x, y, z + dz)
    const n_dz = this.potential(x, y, z - dz)

    // Calculate curl: ∇ × F
    const x_comp = (p_dz - n_dz) / (2 * dy) - (p_dy - n_dy) / (2 * dz)
    const y_comp = (p_dx - n_dx) / (2 * dz) - (p_dz - n_dz) / (2 * dx)
    const z_comp = (p_dy - n_dy) / (2 * dx) - (p_dx - n_dx) / (2 * dy)

    return { x: x_comp, y: y_comp, z: z_comp }
  }

  private potential(x: number, y: number, z: number): number {
    // Use multiple octaves of noise for the potential field
    return (
      this.perlin.noise(x * 1.0, y * 1.0, z * 1.0) * 1.0 +
      this.perlin.noise(x * 2.0, y * 2.0, z * 2.0) * 0.5 +
      this.perlin.noise(x * 4.0, y * 4.0, z * 4.0) * 0.25
    )
  }
}
