import React, { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { PerlinNoise, CurlNoise } from '../utils/noise'

// FAST pixel sampling - directly from ImageData array (no getImageData per pixel!)
function sampleDepth(imageData: ImageData, u: number, v: number): number {
  const x = Math.floor(u * (imageData.width - 1))
  const y = Math.floor(v * (imageData.height - 1))
  const index = (y * imageData.width + x) * 4
  return imageData.data[index] / 255.0
}

function sampleColor(imageData: ImageData, u: number, v: number): { r: number; g: number; b: number } {
  const x = Math.floor(u * (imageData.width - 1))
  const y = Math.floor(v * (imageData.height - 1))
  const index = (y * imageData.width + x) * 4
  return {
    r: imageData.data[index] / 255.0,
    g: imageData.data[index + 1] / 255.0,
    b: imageData.data[index + 2] / 255.0
  }
}

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
  noiseIntensity,
  theme,
  emissionMode
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
  theme: 'dark' | 'light'
  emissionMode: boolean
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

  // Create sampling canvases - prepared once for efficient pixel sampling
  // Extract ImageData ONCE for ultra-fast pixel access
  const samplingData = useMemo(() => {
    if (!colorTex.image || !dispTex.image || !particleData) return null

    // Create canvas to sample pixel colors
    const colorCanvas = document.createElement('canvas')
    colorCanvas.width = colorTex.image.width
    colorCanvas.height = colorTex.image.height
    const colorCtx = colorCanvas.getContext('2d', { willReadFrequently: true })!
    colorCtx.drawImage(colorTex.image, 0, 0)
    const colorImageData = colorCtx.getImageData(0, 0, colorCanvas.width, colorCanvas.height)

    // Create depth canvas
    const depthCanvas = document.createElement('canvas')
    depthCanvas.width = dispTex.image.width
    depthCanvas.height = dispTex.image.height
    const depthCtx = depthCanvas.getContext('2d', { willReadFrequently: true })!
    depthCtx.drawImage(dispTex.image, 0, 0)
    const depthImageData = depthCtx.getImageData(0, 0, depthCanvas.width, depthCanvas.height)

    // Return ImageData for direct pixel array access (MUCH faster than getImageData per pixel!)
    return {
      colorImageData,
      depthImageData
    }
  }, [colorTex, dispTex, particleData])

  // Shader with emission/flat mode toggle
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      size: { value: particleSize },
      scale: { value: window.innerHeight / 2 },
      emissionMode: { value: emissionMode ? 1.0 : 0.0 }
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
      uniform float emissionMode;
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float distSq = dot(coord, coord);
        if (distSq > 0.25) discard;
        
        // Emission mode: bright/glowing particles (1.5x multiplier + additive blending)
        // Flat mode: true colors (1.0x multiplier + normal blending)
        vec3 finalColor = mix(
          vColor,              // Flat mode: accurate colors
          vColor * 1.5,        // Emission mode: bright/emissive
          emissionMode
        );
        
        float alpha = mix(1.0, 0.8, emissionMode);  // Slightly transparent in emission mode
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: emissionMode ? THREE.AdditiveBlending : THREE.NormalBlending
  }), [particleSize, emissionMode])

  // CPU-based animation with efficient canvas sampling
  useFrame(({ clock }) => {
    if (!pointsRef.current || !particleData || !samplingData) return

    const time = clock.getElapsedTime() * animationSpeed
    const geometry = pointsRef.current.geometry
    const positions = geometry.attributes.position.array as Float32Array
    const colors = geometry.attributes.color.array as Float32Array
    const baseUVs = geometry.attributes.baseUV.array as Float32Array
    const { aspect } = particleData

    for (let i = 0; i < positions.length / 3; i++) {
      // Get base UV coordinates for this particle
      let u = baseUVs[i * 2 + 0]
      let v = baseUVs[i * 2 + 1]

      if (animateParticles) {
        // Calculate noise offset for this particle
        let offsetX = 0, offsetY = 0

        if (noiseType === 'perlin') {
          // Simple perlin noise for X and Y
          offsetX = noiseGenerators.perlin.noise(u * 3, v * 3, time * 0.5) * noiseIntensity
          offsetY = noiseGenerators.perlin.noise(u * 3 + 100, v * 3 + 100, time * 0.5) * noiseIntensity
        } else {
          // Curl noise for divergence-free flow
          const curl = noiseGenerators.curl.curl(u * 3, v * 3, time * 0.5, 0.01)
          offsetX = curl.x * noiseIntensity
          offsetY = curl.y * noiseIntensity
        }

        // Apply offset to UV coordinates and clamp to [0, 1]
        u = Math.max(0, Math.min(1, u + offsetX))
        v = Math.max(0, Math.min(1, v + offsetY))
      }

      // Convert UV back to world position
      const xPos = (u - 0.5) * aspect
      const yPos = (v - 0.5) * -1

      // FAST: Sample depth directly from pixel array (no getImageData call!)
      const depth = sampleDepth(samplingData.depthImageData, u, v)
      const zPos = depth * displacementScale

      // Update position
      positions[i * 3 + 0] = xPos
      positions[i * 3 + 1] = yPos
      positions[i * 3 + 2] = zPos

      // FAST: Sample color directly from pixel array
      const color = sampleColor(samplingData.colorImageData, u, v)
      colors[i * 3 + 0] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  if (!particleData) return null

  return (
    <points ref={pointsRef}>
      <primitive object={particleData.geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </points>
  )
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
  noiseIntensity,
  theme,
  emissionMode
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
  theme: 'dark' | 'light'
  emissionMode: boolean
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
      style={{ 
        background: 'var(--canvas-bg)',
        transition: 'background-color 0.3s ease'
      }}
      gl={{
        powerPreference: 'high-performance',
        antialias: true,
        alpha: false,
        stencil: false,
        depth: true,
        preserveDrawingBuffer: false
      }}
    >
      <color attach="background" args={[theme === 'light' ? '#ffffff' : '#000000']} />
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
            theme={theme}
            emissionMode={emissionMode}
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


