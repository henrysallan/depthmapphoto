import React, { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { PerlinNoise, CurlNoise } from '../utils/noise'

function DisplacedPlane({ imageURL, depthURL, displacementScale }: {
  imageURL: string
  depthURL: string
  displacementScale: number
}) {
  const colorTex = useLoader(THREE.TextureLoader, imageURL)
  const dispTex = useLoader(THREE.TextureLoader, depthURL)
  
  useEffect(() => {
    colorTex.wrapS = colorTex.wrapT = THREE.ClampToEdgeWrapping
    colorTex.colorSpace = THREE.SRGBColorSpace
    dispTex.wrapS = dispTex.wrapT = THREE.ClampToEdgeWrapping
  }, [colorTex, dispTex])

  const meshRef = useRef<THREE.Mesh>(null)
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    map: colorTex,
    displacementMap: dispTex,
    displacementScale,
  }), [colorTex, dispTex, displacementScale])

  useEffect(() => {
    material.displacementScale = displacementScale
  }, [displacementScale, material])

  const [w, h] = [colorTex.image?.width ?? 1, colorTex.image?.height ?? 1]
  const aspect = w / h

  return (
    <mesh ref={meshRef} rotation-x={-0.0}>
      <planeGeometry args={[aspect, 1, 256, 256]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

// SIMPLE & STABLE Particle System - GPU textures, minimal shader
function ParticleSystem({ 
  imageURL, 
  depthURL, 
  displacementScale, 
  particleDensity, 
  particleSize,
  animateParticles,
  noiseType,
  animationSpeed,
  noiseIntensity
}: {
  imageURL: string
  depthURL: string
  displacementScale: number
  particleDensity: number
  particleSize: number
  animateParticles: boolean
  noiseType: 'perlin' | 'curl'
  animationSpeed: number
  noiseIntensity: number
}) {
  const colorTex = useLoader(THREE.TextureLoader, imageURL)
  const dispTex = useLoader(THREE.TextureLoader, depthURL)
  const pointsRef = useRef<THREE.Points>(null)
  
  useEffect(() => {
    colorTex.wrapS = colorTex.wrapT = THREE.ClampToEdgeWrapping
    colorTex.colorSpace = THREE.SRGBColorSpace
    dispTex.wrapS = dispTex.wrapT = THREE.ClampToEdgeWrapping
  }, [colorTex, dispTex])

  // Noise generators for CPU-side calculations
  const noiseGenerators = useMemo(() => ({
    perlin: new PerlinNoise(42),
    curl: new CurlNoise(42)
  }), [])

  // Create particle geometry and data
  const particleData = useMemo(() => {
    if (!colorTex.image || !dispTex.image) return null

    const [w, h] = [colorTex.image.width, colorTex.image.height]
    const aspect = w / h
    const sampleW = Math.min(w, particleDensity)
    const sampleH = Math.min(h, particleDensity)
    const particleCount = sampleW * sampleH

    const baseUVs = new Float32Array(particleCount * 2)
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    let index = 0
    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        baseUVs[index * 2 + 0] = x / (sampleW - 1)
        baseUVs[index * 2 + 1] = y / (sampleH - 1)
        
        // Initial positions (will be updated)
        positions[index * 3 + 0] = 0
        positions[index * 3 + 1] = 0
        positions[index * 3 + 2] = 0
        
        colors[index * 3 + 0] = 1
        colors[index * 3 + 1] = 1
        colors[index * 3 + 2] = 1
        
        index++
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('baseUV', new THREE.BufferAttribute(baseUVs, 2))
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    return { geometry, aspect, sampleW, sampleH }
  }, [colorTex, dispTex, particleDensity])

  // SIMPLE shader - just uses position and color, no noise calculations
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      size: { value: particleSize },
      scale: { value: window.innerHeight / 2 }
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      uniform float size;
      uniform float scale;
      
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * scale / -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float distSq = dot(coord, coord);
        if (distSq > 0.25) discard;
        
        vec3 emissiveColor = vColor * 1.5;
        gl_FragColor = vec4(emissiveColor, 0.8);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending
  }), [particleSize])

  // CPU-based animation - update positions in batches
  useFrame(({ clock }) => {
    if (!pointsRef.current || !particleData) return

    const geometry = pointsRef.current.geometry
    const positions = geometry.attributes.position.array as Float32Array
    const colors = geometry.attributes.color.array as Float32Array
    const baseUVs = geometry.attributes.baseUV.array as Float32Array
    const { aspect } = particleData

    const time = clock.getElapsedTime() * animationSpeed
    const particleCount = positions.length / 3

    // Update in small batches to avoid long-running frames
    const batchSize = animateParticles ? 2000 : particleCount // Process all at once if not animating
    const startIdx = animateParticles ? Math.floor((clock.getElapsedTime() * 10) % (particleCount / batchSize)) * batchSize : 0
    const endIdx = Math.min(startIdx + (animateParticles ? batchSize : particleCount), particleCount)

    for (let i = startIdx; i < endIdx; i++) {
      let u = baseUVs[i * 2 + 0]
      let v = baseUVs[i * 2 + 1]

      if (animateParticles) {
        // CPU noise calculation
        let offsetX = 0, offsetY = 0

        if (noiseType === 'perlin') {
          offsetX = noiseGenerators.perlin.noise(u * 3, v * 3, time * 0.5) * noiseIntensity
          offsetY = noiseGenerators.perlin.noise(u * 3 + 100, v * 3 + 100, time * 0.5) * noiseIntensity
        } else {
          const curl = noiseGenerators.curl.curl(u * 3, v * 3, time * 0.5, 0.01)
          offsetX = curl.x * noiseIntensity
          offsetY = curl.y * noiseIntensity
        }

        u = Math.max(0, Math.min(1, u + offsetX))
        v = Math.max(0, Math.min(1, v + offsetY))
      }

      // GPU texture sampling via canvas
      const xPos = (u - 0.5) * aspect
      const yPos = (v - 0.5) * -1

      // Sample from textures (this is fast since textures are GPU-loaded)
      const depthPixel = sampleTexture(dispTex, u, v)
      const colorPixel = sampleTexture(colorTex, u, v)

      positions[i * 3 + 0] = xPos
      positions[i * 3 + 1] = yPos
      positions[i * 3 + 2] = depthPixel.r * displacementScale

      colors[i * 3 + 0] = colorPixel.r
      colors[i * 3 + 1] = colorPixel.g
      colors[i * 3 + 2] = colorPixel.b
    }

    // Only update if we processed this frame
    if (startIdx === 0 || !animateParticles) {
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.color.needsUpdate = true
    }
  })

  if (!particleData) return null

  return (
    <points ref={pointsRef}>
      <primitive object={particleData.geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </points>
  )
}

// Fast texture sampling helper
function sampleTexture(texture: THREE.Texture, u: number, v: number): { r: number; g: number; b: number } {
  if (!texture.image) return { r: 0, g: 0, b: 0 }
  
  // Create a temporary canvas for sampling if needed
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  
  const x = Math.floor(u * texture.image.width)
  const y = Math.floor(v * texture.image.height)
  
  ctx.drawImage(texture.image, x, y, 1, 1, 0, 0, 1, 1)
  const pixel = ctx.getImageData(0, 0, 1, 1).data
  
  return {
    r: pixel[0] / 255.0,
    g: pixel[1] / 255.0,
    b: pixel[2] / 255.0
  }
}

export function ThreeViewer({ 
  imageURL, 
  depthURL, 
  displacementScale, 
  renderMode, 
  bloomIntensity, 
  enableBloom, 
  particleDensity, 
  particleSize,
  animateParticles,
  noiseType,
  animationSpeed,
  noiseIntensity
}: {
  imageURL: string | null
  depthURL: string | null
  displacementScale: number
  renderMode: 'mesh' | 'particles'
  bloomIntensity: number
  enableBloom: boolean
  particleDensity: number
  particleSize: number
  animateParticles: boolean
  noiseType: 'perlin' | 'curl'
  animationSpeed: number
  noiseIntensity: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // WebGL context loss handling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleContextLost = (event: WebGLContextEvent) => {
      console.error('WebGL context lost. Preventing default to attempt recovery...')
      event.preventDefault()
    }

    const handleContextRestored = () => {
      console.log('WebGL context restored!')
    }

    canvas.addEventListener('webglcontextlost', handleContextLost as any)
    canvas.addEventListener('webglcontextrestored', handleContextRestored as any)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost as any)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored as any)
    }
  }, [])

  return (
    <Canvas 
      ref={canvasRef}
      camera={{ position: [0, 0, 1.8], fov: 50 }} 
      style={{ background: '#000' }}
      gl={{
        powerPreference: 'high-performance',
        antialias: true,
        alpha: false,
        stencil: false,
        depth: true,
        preserveDrawingBuffer: false
      }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[2, 3, 2]} intensity={0.7} />
      {imageURL && depthURL ? (
        renderMode === 'mesh' ? (
          <DisplacedPlane imageURL={imageURL} depthURL={depthURL} displacementScale={displacementScale} />
        ) : (
          <ParticleSystem 
            imageURL={imageURL} 
            depthURL={depthURL} 
            displacementScale={displacementScale} 
            particleDensity={particleDensity} 
            particleSize={particleSize}
            animateParticles={animateParticles}
            noiseType={noiseType}
            animationSpeed={animationSpeed}
            noiseIntensity={noiseIntensity}
          />
        )
      ) : null}
      <OrbitControls enableDamping dampingFactor={0.1} />
      
      {enableBloom && renderMode === 'particles' && (
        <EffectComposer>
          <Bloom 
            intensity={bloomIntensity}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            height={300}
          />
        </EffectComposer>
      )}
    </Canvas>
  )
}
