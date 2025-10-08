import { pipeline, RawImage } from '@huggingface/transformers'
import { logger } from '../utils/logger'

export class WorkingDepthEstimator {
  private pipeline: any = null

  async estimateDepth(imageURL: string): Promise<{ depthCanvas: HTMLCanvasElement; depthMap: Float32Array }> {
    logger.info('Using working depth estimation (based on HF example)')
    
    if (!this.pipeline) {
      await this.loadPipeline()
    }

    // Use RawImage.fromURL like in the working example
    const image = await RawImage.fromURL(imageURL)
    logger.debug('Image loaded with RawImage', { width: image.width, height: image.height })
    
    // Run inference exactly like the working example
    const { depth } = await this.pipeline(image)
    logger.debug('Inference completed')
    
    // Convert to canvas using the built-in toCanvas method
    const depthCanvas = depth.toCanvas() as HTMLCanvasElement
    
    // Extract Float32Array from the depth tensor
    const depthMap = depth.data as Float32Array
    
    logger.info('Working depth estimation completed')
    return { depthCanvas, depthMap }
  }
  
  private async loadPipeline() {
    logger.info('Loading pipeline: onnx-community/depth-anything-v2-small')
    
    try {
      this.pipeline = await pipeline(
        'depth-estimation',
        'onnx-community/depth-anything-v2-small'
      )
      logger.info('Pipeline loaded successfully')
    } catch (error: any) {
      logger.error('Failed to load pipeline:', error?.message || String(error))
      throw new Error(`Pipeline loading failed: ${error?.message || String(error)}`)
    }
  }
}