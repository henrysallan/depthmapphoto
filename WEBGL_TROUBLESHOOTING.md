# WebGL Context Loss - Troubleshooting Guide

## Problem: "WebGL context was lost"

This error occurs when the GPU runs out of resources or encounters an issue that forces it to lose the WebGL rendering context.

## Common Causes

### 1. **Too Many Particles**
- High-resolution images (3648×5472) with high particle density
- GPU memory exhaustion
- Too many draw calls

### 2. **Complex Shaders**
- Perlin/Curl noise functions are mathematically intensive
- Multiple texture lookups per particle
- High instruction count in vertex shader

### 3. **Texture Size**
- Large textures consume VRAM
- Multiple large textures (color + depth)
- No mipmaps or compression

### 4. **GPU Driver Issues**
- Driver timeout detection
- GPU switching (laptop with integrated + dedicated GPU)
- Browser GPU process crash

## Fixes Implemented

### ✅ 1. Particle Count Limiting
```typescript
const maxSafeDensity = 512
const safeDensity = Math.min(particleDensity, maxSafeDensity)
```
- Caps max particles at 512×512 (262K)
- Warns if count exceeds 200K

### ✅ 2. Shader Optimization
```glsl
precision highp float;  // Vertex shader
precision mediump float; // Fragment shader (less precision needed)
```
- Reduced precision where possible
- Optimized distance calculation (dot product vs distance())
- Conditional noise code inclusion

### ✅ 3. Context Loss Handling
```typescript
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault()  // Attempt recovery
})
```
- Prevents immediate failure
- Allows WebGL to recover
- Logs errors for debugging

### ✅ 4. GL Context Settings
```typescript
gl={{
  powerPreference: 'high-performance',  // Use dedicated GPU
  antialias: true,
  alpha: false,  // No alpha channel (saves memory)
  stencil: false,  // Not needed (saves memory)
  preserveDrawingBuffer: false,  // Don't keep buffer (saves memory)
}}
```

### ✅ 5. Texture Optimization
```typescript
colorTex.minFilter = THREE.LinearFilter  // No mipmaps
colorTex.magFilter = THREE.LinearFilter
colorTex.anisotropy = 4  // Conservative value
```

### ✅ 6. Memory Cleanup
```typescript
useEffect(() => {
  return () => {
    if (geometry) geometry.dispose()
    if (material) material.dispose()
  }
}, [geometry, material])
```

## Solutions for Users

### Quick Fixes:

1. **Reduce Particle Density**
   - Try 256×256 instead of 512×512
   - Lower density for high-res images

2. **Disable Animation**
   - Turn off "ANIMATE_PARTICLES"
   - Simpler shader = less GPU load

3. **Use Lower Resolution Images**
   - Resize images before upload
   - 1920×1080 or smaller recommended

4. **Refresh Browser**
   - Clear GPU memory
   - Close other GPU-intensive tabs

5. **Update GPU Drivers**
   - Check for latest drivers
   - May fix timeout issues

### Advanced Solutions:

#### A. Enable GPU Process Logging
In Chrome:
```
chrome://gpu
```
Check for warnings or errors

#### B. Increase GPU Timeout (Advanced Users)
Windows Registry (use with caution):
```
HKEY_LOCAL_MACHINE\System\CurrentControlSet\Control\GraphicsDrivers
TdrDelay = 10 (seconds)
```

#### C. Force Hardware Acceleration
Chrome flags:
```
chrome://flags/#ignore-gpu-blocklist
chrome://flags/#enable-gpu-rasterization
```

## Monitoring GPU Usage

### Browser DevTools:
1. Open DevTools (F12)
2. Performance tab
3. Enable "Screenshots" and "Memory"
4. Record while switching to particles
5. Look for memory spikes

### Task Manager:
- Windows: Task Manager → Performance → GPU
- Mac: Activity Monitor → GPU
- Look for VRAM usage

## Prevention Best Practices

### For Development:

1. **Progressive Loading**
```typescript
// Start with low density, increase gradually
const [density, setDensity] = useState(64)
```

2. **Texture Compression**
```typescript
// Use compressed texture formats if supported
renderer.capabilities.getMaxAnisotropy()
```

3. **LOD System**
```typescript
// Reduce particles when zoomed out
const particleCount = Math.floor(baseDensity * lodFactor)
```

### For Production:

1. **Detect GPU Tier**
```typescript
import { getGPUTier } from 'detect-gpu'
const tier = await getGPUTier()
const maxDensity = tier.tier === 3 ? 512 : tier.tier === 2 ? 256 : 128
```

2. **Graceful Degradation**
```typescript
if (contextLost) {
  // Fall back to mesh mode or static view
  setRenderMode('mesh')
}
```

3. **Warning UI**
```typescript
if (imageWidth * imageHeight > 10000000) {
  showWarning('High resolution image may cause performance issues')
}
```

## Testing Checklist

- [ ] Test with 1920×1080 image @ 256×256 density
- [ ] Test with 3648×5472 image @ 128×128 density
- [ ] Toggle animation on/off
- [ ] Switch between Perlin and Curl noise
- [ ] Monitor GPU memory in Task Manager
- [ ] Check for warnings in console
- [ ] Test on integrated GPU (if available)
- [ ] Test in different browsers (Chrome, Firefox, Edge)

## Error Messages Decoded

### "WebGL context was lost"
→ GPU ran out of resources or driver timeout

### "WARNING: too many active WebGL contexts"
→ Other tabs/apps using WebGL, close them

### "CONTEXT_LOST_WEBGL: loseContext: context lost"
→ Intentional context loss for resource management

### "WebGL: INVALID_OPERATION"
→ Shader compilation or texture binding issue

## Performance Benchmarks

| Image Size    | Particles | Expected FPS | GPU VRAM |
|--------------|-----------|--------------|----------|
| 1920×1080    | 256×256   | 60 FPS       | ~50 MB   |
| 3648×5472    | 256×256   | 60 FPS       | ~100 MB  |
| 3648×5472    | 512×512   | 30-60 FPS    | ~120 MB  |

## Still Having Issues?

1. Check browser console for specific errors
2. Try in incognito mode (disable extensions)
3. Test on a different device
4. Report issue with:
   - GPU model
   - Browser version
   - Image resolution
   - Particle density setting
   - Console errors

## Future Improvements

- [ ] Automatic LOD based on GPU tier
- [ ] Texture streaming for large images
- [ ] Worker-based depth preprocessing
- [ ] Canvas-based fallback mode
- [ ] Better error recovery UI

---

**Current Status**: Optimized for stability. Should work on most modern GPUs with images up to 4K resolution and 256×256 particles. Higher settings may require dedicated GPU.
