import { logger } from '../utils/logger'

export class ONNXDebugger {
  static async testONNXImport() {
    logger.info('Testing ONNX Runtime import...')
    
    try {
      // Test dynamic import
      const ort = await import('onnxruntime-web')
      
      logger.debug('ONNX import successful:', {
        isObject: typeof ort === 'object',
        keys: Object.keys(ort),
        hasDefault: 'default' in ort,
        hasInferenceSession: 'InferenceSession' in ort,
        hasTensor: 'Tensor' in ort,
        hasEnv: 'env' in ort
      })
      
      if (ort.env) {
        logger.debug('ort.env details:', {
          type: typeof ort.env,
          isObject: typeof ort.env === 'object',
          keys: Object.keys(ort.env),
          hasWasm: 'wasm' in ort.env,
          wasmValue: ort.env.wasm
        })
        
        // Try to access wasm property in different ways
        try {
          const wasm = ort.env.wasm
          logger.debug('Direct wasm access:', { wasm, type: typeof wasm })
        } catch (e: any) {
          logger.error('Direct wasm access failed:', e.message)
        }
        
        try {
          const wasmProp = Object.getOwnPropertyDescriptor(ort.env, 'wasm')
          logger.debug('wasm property descriptor:', wasmProp)
        } catch (e: any) {
          logger.error('Property descriptor failed:', e.message)
        }
      }
      
      return true
    } catch (error: any) {
      logger.error('ONNX import failed:', {
        message: error?.message,
        stack: error?.stack
      })
      return false
    }
  }
}