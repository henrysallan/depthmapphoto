import React, { useMemo, useRef, useState } from 'react'
// Lazy-load DepthEstimator only when needed to avoid heavy startup cost
import { ThreeViewer } from './components/ThreeViewer'
import { Toolbar } from './components/Toolbar'
import { useDropZone } from './hooks/useDropZone'
import { DebugPanel } from './components/DebugPanel'
import { logger } from './utils/logger'

export default function App() {
  const [imageURL, setImageURL] = useState<string | null>(null)
  const [depthURL, setDepthURL] = useState<string | null>(null)
  const [displacementScale, setDisplacementScale] = useState(0.05)
  const [loading, setLoading] = useState(false)
  const [useMock, setUseMock] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [renderMode, setRenderMode] = useState<'mesh' | 'particles'>('mesh')
  const [error, setError] = useState<string | null>(null)
  const [bloomIntensity, setBloomIntensity] = useState(1.5)
  const [enableBloom, setEnableBloom] = useState(true)
  const [particleDensity, setParticleDensity] = useState(256)
  const [particleSize, setParticleSize] = useState(0.003)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [emissionMode, setEmissionMode] = useState(true)
  
  // Animation controls
  const [animateParticles, setAnimateParticles] = useState(false)
  const [noiseType, setNoiseType] = useState<'perlin' | 'curl'>('perlin')
  const [animationSpeed, setAnimationSpeed] = useState(0.5)
  const [noiseIntensity, setNoiseIntensity] = useState(0.1)

  const depthEstimatorRef = useRef<any | null>(null)

  const onFiles = async (files: File[]) => {
    const file = files[0]
    if (!file) return

    logger.info('file:selected', { name: file.name, type: file.type, size: file.size })
    const url = URL.createObjectURL(file)
    setImageURL(url)
    setDepthURL(null)
    setError(null)
    setLoading(true)
    try {
      let depthCanvas: HTMLCanvasElement
      if (useMock) {
        logger.info('using:mock-depth')
        depthCanvas = await generateMockDepth(url)
      } else {
        if (!depthEstimatorRef.current) {
          logger.info('loading:DepthEstimator')
          
          try {
            // Try the working implementation first (based on HF example)
            const workingMod = await import('./depth/WorkingDepthEstimator')
            depthEstimatorRef.current = new workingMod.WorkingDepthEstimator()
            logger.info('Using WorkingDepthEstimator (HF transformers)')
          } catch (e: any) {
            logger.warn('Working estimator failed, trying others:', e?.message || String(e))
            try {
              // Fallback to simple edge-based depth estimation
              const simpleMod = await import('./depth/SimpleDepthEstimator')
              depthEstimatorRef.current = new simpleMod.SimpleDepthEstimator()
              logger.info('Using SimpleDepthEstimator instead')
            } catch (e2: any) {
              logger.error('All estimators failed:', e2?.message || String(e2))
              throw new Error('No depth estimator available')
            }
          }
        }
        logger.info('estimating:depth')
        const result = await depthEstimatorRef.current.estimateDepth(url)
        depthCanvas = result.depthCanvas
        logger.debug('got depth canvas', { 
          width: depthCanvas.width, 
          height: depthCanvas.height,
          isHTMLCanvas: depthCanvas instanceof HTMLCanvasElement,
          isOffscreenCanvas: depthCanvas instanceof OffscreenCanvas,
          constructor: depthCanvas.constructor.name,
          hasToBlob: !!depthCanvas.toBlob,
          hasConvertToBlob: !!(depthCanvas as any).convertToBlob
        })
      }
      // Convert to blob URL for Three texture
      logger.debug('converting canvas to blob...')
      let blob: Blob | null = null
      
      // Handle both OffscreenCanvas and HTMLCanvasElement
      if (depthCanvas instanceof OffscreenCanvas) {
        logger.debug('using OffscreenCanvas.convertToBlob()')
        blob = await depthCanvas.convertToBlob({ type: 'image/png' })
      } else {
        logger.debug('using HTMLCanvasElement.toBlob()')
        blob = await new Promise<Blob | null>((resolve, reject) => {
          const timeout = setTimeout(() => {
            logger.error('toBlob timed out after 5 seconds')
            reject(new Error('toBlob timeout'))
          }, 5000)
          
          depthCanvas.toBlob((blob) => {
            clearTimeout(timeout)
            logger.debug('toBlob callback called', { hasBlob: !!blob })
            resolve(blob)
          }, 'image/png')
        })
      }
      logger.debug('blob creation finished', { hasBlob: !!blob })
      if (!blob) {
        logger.warn('Blob creation failed, trying canvas.toDataURL fallback')
        try {
          const dataURL = depthCanvas.toDataURL('image/png')
          setDepthURL(dataURL)
          logger.info('depth:ready (dataURL fallback)', { dataURL: dataURL.substring(0, 50) + '...' })
          return
        } catch (dataUrlError: any) {
          logger.error('DataURL fallback also failed:', dataUrlError?.message)
          throw new Error('Failed to create depth PNG')
        }
      }
      const depthUrl = URL.createObjectURL(blob)
      logger.debug('created object URL', { depthUrl })
      setDepthURL(depthUrl)
      logger.info('depth:ready', { depthUrl })
    } catch (e: any) {
      const msg = e?.message ?? String(e)
      setError(`Depth estimation failed: ${msg}. Falling back to mock depth.`)
      logger.error('depth:failed', msg)
      try {
        const depthCanvas = await generateMockDepth(url)
        const blob = await new Promise<Blob | null>((resolve) => (depthCanvas as HTMLCanvasElement).toBlob(resolve, 'image/png'))
        if (blob) {
          const depthUrl = URL.createObjectURL(blob)
          setDepthURL(depthUrl)
          setUseMock(true)
          logger.info('mock-depth:ready', { depthUrl })
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  const { dropProps, isOver } = useDropZone({ onFiles })

  return (
    <div className={`app theme-${theme}`}>
      <header>
        <h1>DEPTH_MAP_PHOTO :: AI_3D_RECONSTRUCTION</h1>
        <button 
          className="theme-toggle" 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>
      <Toolbar
        displacementScale={displacementScale}
        onScaleChange={setDisplacementScale}
        loading={loading}
        useMock={useMock}
        onToggleMock={setUseMock}
        renderMode={renderMode}
        onRenderModeChange={setRenderMode}
        bloomIntensity={bloomIntensity}
        onBloomIntensityChange={setBloomIntensity}
        enableBloom={enableBloom}
        onToggleBloom={setEnableBloom}
        particleDensity={particleDensity}
        onParticleDensityChange={setParticleDensity}
        particleSize={particleSize}
        onParticleSizeChange={setParticleSize}
        animateParticles={animateParticles}
        onToggleAnimation={setAnimateParticles}
        noiseType={noiseType}
        onNoiseTypeChange={setNoiseType}
        animationSpeed={animationSpeed}
        onAnimationSpeedChange={setAnimationSpeed}
        noiseIntensity={noiseIntensity}
        onNoiseIntensityChange={setNoiseIntensity}
        emissionMode={emissionMode}
        onToggleEmission={setEmissionMode}
      />
      <div className="controls-section">
        <label>
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          DEBUG_PANEL
        </label>
        <small>
          STATUS: {loading ? 'PROCESSING...' : useMock ? 'MOCK_DEPTH' : 'AI_DEPTH'} | MODE: {renderMode.toUpperCase()}
        </small>
      </div>
      <div className={`dropzone ${isOver ? 'over' : ''}`} {...dropProps} onClick={() => {
        const input = document.getElementById('file-input') as HTMLInputElement | null
        input?.click()
      }}>
        <p>DROP_IMAGE_HERE || CLICK_TO_SELECT<br />
        <span style={{ fontSize: '11px', color: '#555' }}>FORMATS: JPG | PNG | WEBP</span></p>
        <input id="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) onFiles(Array.from(e.target.files))
          }}
        />
      </div>

      <div className="columns">
        <div className="column">
          <h2>ORIGINAL</h2>
          <div className="panel">
            {imageURL ? (
              <img src={imageURL} alt="input" />
            ) : (
              <div className="placeholder">NO_IMAGE</div>
            )}
          </div>
        </div>
        <div className="column">
          <h2>DEPTH_MAP</h2>
          <div className="panel">
            {loading && <div className="placeholder">ESTIMATING...</div>}
            {!loading && depthURL && <img src={depthURL} alt="depth" />}
            {!loading && !depthURL && <div className="placeholder">NO_DEPTH_YET</div>}
          </div>
        </div>
        <div className="column">
          <h2>3D VIEWER</h2>
          <div className="panel viewer">
            <ThreeViewer 
              imageURL={imageURL} 
              depthURL={depthURL} 
              displacementScale={displacementScale}
              renderMode={renderMode}
              bloomIntensity={bloomIntensity}
              enableBloom={enableBloom}
              particleDensity={particleDensity}
              particleSize={particleSize}
              animateParticles={animateParticles}
              noiseType={noiseType}
              animationSpeed={animationSpeed}
              noiseIntensity={noiseIntensity}
              theme={theme}
              emissionMode={emissionMode}
            />
          </div>
        </div>
      </div>

  {error && <div className="error">{error}</div>}
  <DebugPanel open={showDebug} onClear={() => logger.clear()} />

      <footer>
        <small>CLIENT_SIDE_DEPTH_ESTIMATION_AND_3D_DISPLACEMENT :: POWERED_BY_TRANSFORMERS.JS</small>
      </footer>
    </div>
  )
}

async function generateMockDepth(imageURL: string): Promise<HTMLCanvasElement> {
  // Create a radial gradient depth from the image size
  const img = await loadImage(imageURL)
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(w, h)
  const cx = w / 2
  const cy = h / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx
      const dy = y - cy
      const r = Math.sqrt(dx * dx + dy * dy)
      const n = 1 - Math.min(1, r / maxR)
      const v = Math.floor(n * 255)
      const i = (y * w + x) * 4
      imageData.data[i + 0] = v
      imageData.data[i + 1] = v
      imageData.data[i + 2] = v
      imageData.data[i + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
