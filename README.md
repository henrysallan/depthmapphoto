# Depth Map Photo (React + Vite + Three.js)

Client-side app that:
- accepts an image (JPG/PNG/WebP)
- runs AI depth estimation in the browser
- displays the original image, depth map, and a 3D viewer with real-time displacement mapping.

## Tech
- Vite + React + TypeScript
- Three.js via @react-three/fiber and @react-three/drei
- Depth estimation via @xenova/transformers (DPT-Large) – runs client-side, uses WebAssembly/WebGPU

## Implementation steps

1. Bootstrapping
   - Create Vite React TS project
   - Add dependencies: three, @react-three/fiber, @react-three/drei, @xenova/transformers
   - Configure tsconfig and basic files

2. UI
   - Simple toolbar with one control: displacement intensity
   - Drag-and-drop zone and file input
   - 3 columns layout: Original | Depth map | 3D viewer

3. Depth estimation (client-side)
   - Load image as object URL
   - Use @xenova/transformers pipeline('depth-estimation', 'Xenova/dpt-large')
   - Normalize predicted depth to 0..1 and render to a canvas as grayscale PNG
   - Keep only client-side artifacts (no uploads, no server)

4. Three.js viewer
   - Build a plane with segments (256x256)
   - Map original image as color texture
   - Map depth PNG as displacementMap
   - Orbit controls and simple lighting
   - Slider adjusts MeshStandardMaterial.displacementScale in real-time

5. Image handling
   - Accept JPG, PNG, WebP
   - Auto-resize internally by the model’s preprocessing; optionally we can add a pre-resize to limit extremely large images.

## Running locally

1. Install deps
```powershell
npm install
```
2. Start dev server
```powershell
npm run dev
```
3. Open the URL shown (usually http://localhost:5173)

## Notes
- First run will download the model to the browser cache. This may take time and requires network access.
- WebGPU can speed things up when available; otherwise it falls back to WebAssembly.
- Displacement uses grayscale depth directly; you can experiment with inverting or re-scaling for different looks.

## Next steps (optional)
- Add colormap selection and inversion for depth view
- Export: allow downloading the depth map PNG
- Advanced controls: wireframe, tessellation density, exposure, lighting presets
- Performance: dynamic geometry subdivision based on image size, use simplified normals
