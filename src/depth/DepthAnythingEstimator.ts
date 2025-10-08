import { logger } from '../utils/logger'

// Depth Anything Web implementation
export class DepthAnythingEstimator {
  private model: any = null
  private session: any = null

  async estimateDepth(imageURL: string): Promise<{ depthCanvas: HTMLCanvasElement; depthMap: Float32Array }> {
    logger.info('Using Depth Anything Web model')
    
    if (!this.model) {
      await this.loadModel()
    }

    const img = await this.loadImage(imageURL)
    logger.debug('Image loaded', { w: img.width, h: img.height })
    
    // Preprocess image for the model
    const inputTensor = await this.preprocessImage(img)
    logger.debug('Image preprocessed')
    
    // Run inference
    const outputs = await this.session.run({ image: inputTensor })
    const depthOutput = outputs.depth
    
    logger.debug('Inference completed', { outputShape: depthOutput.dims })
    
    // Post-process the depth map
    const depthCanvas = this.postprocessDepth(depthOutput, img.width, img.height)
    const depthMap = this.extractDepthData(depthOutput)
    
    logger.info('Depth Anything estimation completed')
    return { depthCanvas, depthMap }
  }
  
  private async loadModel() {
    logger.info('Loading Depth Anything model...')
    
    try {
      // Use ONNX Runtime Web for better compatibility
      const ort = await import('onnxruntime-web')
      
      // Let's inspect what we actually get from the import
      logger.debug('ONNX Runtime import details:', {
        hasOrt: !!ort,
        ortKeys: Object.keys(ort),
        hasEnv: !!ort.env,
        envType: typeof ort.env,
        envKeys: ort.env ? Object.keys(ort.env) : 'no env',
        hasWasm: !!ort.env?.wasm,
        wasmType: typeof ort.env?.wasm,
        wasmKeys: ort.env?.wasm ? Object.keys(ort.env.wasm) : 'no wasm'
      })
      
      // Try to configure ONNX Runtime step by step
      if (!ort.env) {
        throw new Error('ort.env is not available')
      }
      
      logger.debug('ort.env available, checking wasm...')
      
      if (!ort.env.wasm) {
        logger.warn('ort.env.wasm is undefined, trying to initialize...')
        // Sometimes we need to access other properties first to trigger initialization
        logger.debug('Available env properties:', Object.getOwnPropertyNames(ort.env))
      }
      
      // Try alternative configuration approaches
      try {
        if (ort.env.wasm) {
          ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/'
          logger.debug('Set wasmPaths successfully')
        }
      } catch (wasmError: any) {
        logger.warn('Could not set wasmPaths:', wasmError.message)
      }
      
      // Use a test model URL first
      const modelUrl = 'https://huggingface.co/onnx-community/depth-anything-small/resolve/main/model.onnx'
      
      logger.debug('Attempting to create inference session...')
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'basic'
      })
      
      logger.info('Depth Anything model loaded successfully')
    } catch (error: any) {
      logger.error('Detailed error in loadModel:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      })
      throw new Error(`Model loading failed: ${error?.message || String(error)}`)
    }
  }
  
  private async preprocessImage(img: HTMLImageElement): Promise<any> {
    // Use smaller input size for better compatibility
    const targetSize = 384
    
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const ctx = canvas.getContext('2d')!
    
    // Resize and normalize
    ctx.drawImage(img, 0, 0, targetSize, targetSize)
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize)
    
    // Convert to tensor format (1, 3, 384, 384) with normalization
    const tensor = new Float32Array(1 * 3 * targetSize * targetSize)
    const mean = [0.485, 0.456, 0.406]
    const std = [0.229, 0.224, 0.225]
    
    for (let i = 0; i < targetSize * targetSize; i++) {
      const pixelIndex = i * 4
      // Normalize RGB channels
      tensor[i] = (imageData.data[pixelIndex] / 255.0 - mean[0]) / std[0] // R
      tensor[targetSize * targetSize + i] = (imageData.data[pixelIndex + 1] / 255.0 - mean[1]) / std[1] // G
      tensor[targetSize * targetSize * 2 + i] = (imageData.data[pixelIndex + 2] / 255.0 - mean[2]) / std[2] // B
    }
    
    const ort = await import('onnxruntime-web')
    return new ort.Tensor('float32', tensor, [1, 3, targetSize, targetSize])
  }
  
  private postprocessDepth(depthTensor: any, originalWidth: number, originalHeight: number): HTMLCanvasElement {
    const [batchSize, height, width] = depthTensor.dims
    const depthData = depthTensor.data
    
    // Normalize depth values
    let min = Infinity, max = -Infinity
    for (let i = 0; i < depthData.length; i++) {
      if (depthData[i] < min) min = depthData[i]
      if (depthData[i] > max) max = depthData[i]
    }
    const range = max - min || 1
    
    logger.debug('Depth stats', { min, max, range })
    
    // Create canvas at model output size first
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')!
    const imageData = tempCtx.createImageData(width, height)
    
    // Convert to grayscale
    for (let i = 0; i < depthData.length; i++) {
      const normalized = (depthData[i] - min) / range
      const gray = Math.floor(normalized * 255)
      imageData.data[i * 4 + 0] = gray
      imageData.data[i * 4 + 1] = gray
      imageData.data[i * 4 + 2] = gray
      imageData.data[i * 4 + 3] = 255
    }
    tempCtx.putImageData(imageData, 0, 0)
    
    // Scale to original image size
    const canvas = document.createElement('canvas')
    canvas.width = originalWidth
    canvas.height = originalHeight
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, originalWidth, originalHeight)
    
    return canvas
  }
  
  private extractDepthData(depthTensor: any): Float32Array {
    return depthTensor.data
  }
  
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }
}