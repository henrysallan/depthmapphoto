import { logger } from '../utils/logger'

export class SimpleDepthEstimator {
  async estimateDepth(imageURL: string): Promise<{ depthCanvas: HTMLCanvasElement; depthMap: Float32Array }> {
    logger.info('Using simple depth estimation (edge-based)')
    
    const img = await this.loadImage(imageURL)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    
    // Draw original image
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Simple edge-based depth estimation
    const depthData = this.computeEdgeDepth(imageData)
    
    // Convert to grayscale canvas
    const depthCanvas = document.createElement('canvas')
    depthCanvas.width = canvas.width
    depthCanvas.height = canvas.height
    const depthCtx = depthCanvas.getContext('2d')!
    const depthImageData = depthCtx.createImageData(canvas.width, canvas.height)
    
    for (let i = 0; i < depthData.length; i++) {
      const val = Math.floor(depthData[i] * 255)
      depthImageData.data[i * 4 + 0] = val
      depthImageData.data[i * 4 + 1] = val
      depthImageData.data[i * 4 + 2] = val
      depthImageData.data[i * 4 + 3] = 255
    }
    
    depthCtx.putImageData(depthImageData, 0, 0)
    
    logger.info('Simple depth estimation completed')
    return { depthCanvas, depthMap: depthData }
  }
  
  private computeEdgeDepth(imageData: ImageData): Float32Array {
    const { width, height, data } = imageData
    const depthMap = new Float32Array(width * height)
    
    // Convert to grayscale and compute edges
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4
        
        // Get grayscale value
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        
        // Simple edge detection (Sobel-like)
        const neighbors = [
          this.getGray(data, x-1, y-1, width),
          this.getGray(data, x, y-1, width),
          this.getGray(data, x+1, y-1, width),
          this.getGray(data, x-1, y, width),
          this.getGray(data, x+1, y, width),
          this.getGray(data, x-1, y+1, width),
          this.getGray(data, x, y+1, width),
          this.getGray(data, x+1, y+1, width)
        ]
        
        let edgeStrength = 0
        for (const neighbor of neighbors) {
          edgeStrength += Math.abs(gray - neighbor)
        }
        edgeStrength /= neighbors.length
        
        // Invert so edges are closer (higher displacement)
        depthMap[y * width + x] = Math.min(1, 1 - edgeStrength / 128)
      }
    }
    
    return depthMap
  }
  
  private getGray(data: Uint8ClampedArray, x: number, y: number, width: number): number {
    const idx = (y * width + x) * 4
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3
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