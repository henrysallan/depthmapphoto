import { pipeline, env } from '@xenova/transformers'
import { logger } from '../utils/logger'

// Configure transformers.js runtime more defensively
try {
  env.allowRemoteModels = true
  env.useBrowserCache = true
  env.backends.onnx.wasm.numThreads = 1
  // Use official CDN for WASM files
  env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.15.1/dist/'
  logger.debug('Transformers environment configured')
} catch (e: any) {
  logger.error('Failed to configure transformers environment:', e?.message || String(e))
}

export class DepthEstimator {
  private pipePromise: Promise<any> | null = null

  private getPipeline() {
    if (!this.pipePromise) {
      // Try MiDaS small first - it's lighter and more reliable
      logger.info('Initializing depth pipeline: Xenova/midas-v2-small')
      this.pipePromise = this.createPipelineWithFallbacks()
    }
    return this.pipePromise
  }

  private async createPipelineWithFallbacks() {
    const models = ['Xenova/midas-v2-small', 'Xenova/dpt-hybrid', 'Xenova/dpt-large']
    
    for (const model of models) {
      try {
        logger.debug(`Trying model: ${model}`)
        const pipe = await pipeline('depth-estimation', model)
        logger.info(`Successfully loaded model: ${model}`)
        return pipe
      } catch (e: any) {
        logger.warn(`Model ${model} failed:`, e?.message || String(e))
        // Continue to next model
      }
    }
    
    throw new Error('All depth estimation models failed to load')
  }

  async estimateDepth(imageURL: string): Promise<{ depthCanvas: HTMLCanvasElement; depthMap: Float32Array }> {
    logger.debug('estimateDepth:start', { imageURL })
    let pipe = await this.getPipeline()
    const img = await this.loadImage(imageURL)
    logger.debug('image loaded', { w: img.width, h: img.height })
    const inputImageData = this.imageToImageData(img)
    logger.debug('converted to ImageData', { w: inputImageData.width, h: inputImageData.height })
    let result: any
    try {
      logger.debug('Running inference...')
      result = await pipe(inputImageData)
      logger.debug('Inference completed', { result: typeof result, hasDepth: !!result?.depth })
    } catch (e: any) {
      logger.error('Inference failed:', e?.message || String(e))
      throw e
    }
    // result.depth is a 2D tensor; convert to canvas for display
    if (!result || !result.depth) {
      throw new Error('Model returned no depth data')
    }
    
    const depth = result.depth
    logger.debug('Processing depth tensor', { dims: depth.dims, type: typeof depth.data })
    
    if (!depth.dims || depth.dims.length !== 2) {
      throw new Error(`Invalid depth tensor dimensions: ${depth.dims}`)
    }
    
    const [h, w] = depth.dims as [number, number]
    const data = depth.data as Float32Array
    
    if (!data || data.length !== h * w) {
      throw new Error(`Invalid depth data: expected ${h * w} values, got ${data?.length || 0}`)
    }
    let min = Infinity, max = -Infinity
    for (let i = 0; i < data.length; i++) {
      const v = data[i]
      if (v < min) min = v
      if (v > max) max = v
    }
    const range = max - min || 1
    logger.debug('depth stats', { min, max, range })

  const canvasSmall = document.createElement('canvas')
  canvasSmall.width = w
  canvasSmall.height = h
  const ctxSmall = canvasSmall.getContext('2d')!
  const grayImageData = ctxSmall.createImageData(w, h)
    for (let i = 0; i < data.length; i++) {
      const n = (data[i] - min) / range
      const v = Math.floor(n * 255)
      grayImageData.data[i * 4 + 0] = v
      grayImageData.data[i * 4 + 1] = v
      grayImageData.data[i * 4 + 2] = v
      grayImageData.data[i * 4 + 3] = 255
    }
    ctxSmall.putImageData(grayImageData, 0, 0)

  // Scale to original image size for correct texture mapping
  const canvas = document.createElement('canvas')
  canvas.width = (img as HTMLImageElement).width
  canvas.height = (img as HTMLImageElement).height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvasSmall, 0, 0, w, h, 0, 0, canvas.width, canvas.height)

  logger.debug('estimateDepth:done', { outW: canvas.width, outH: canvas.height })
  return { depthCanvas: canvas, depthMap: data }
  }

  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }

  private imageToImageData(img: HTMLImageElement): ImageData {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }
}
