# Particle Visibility in Light Mode Fix ✅

## Problem
Particles were **invisible in light mode** because they were bright/emissive (white colors) against a white background. Dark mode worked fine because bright particles showed well against black.

## Root Cause
The particle shader was using:
```glsl
vec3 emissiveColor = vColor * 1.5;  // Always brighten colors
```

This made particles bright/emissive, which looked great on black but disappeared on white.

## Solution
Make particles **theme-aware** - darken them in light mode, brighten them in dark mode.

### Changes Made

#### 1. Pass Theme to ParticleSystem
**src/components/ThreeViewer.tsx** (line ~370):
```tsx
<ParticleSystem 
  // ...other props
  theme={theme}  // ✅ Pass theme to particles
/>
```

**ParticleSystem component signature**:
```tsx
function ParticleSystem({ 
  // ...other props
  theme
}: {
  // ...other types
  theme: 'dark' | 'light'  // ✅ Accept theme
}) {
```

#### 2. Update Shader with Theme-Aware Colors
**Material uniforms**:
```tsx
uniforms: {
  size: { value: particleSize },
  scale: { value: window.innerHeight / 2 },
  isLightMode: { value: theme === 'light' ? 1.0 : 0.0 }  // ✅ Pass theme to shader
}
```

**Fragment shader**:
```glsl
uniform float isLightMode;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float distSq = dot(coord, coord);
  if (distSq > 0.25) discard;
  
  // Theme-aware color adjustment
  vec3 adjustedColor = mix(
    vColor * 1.5,    // Dark mode: bright/emissive (150% brightness)
    vColor * 0.6,    // Light mode: darkened (60% brightness)
    isLightMode
  );
  
  gl_FragColor = vec4(adjustedColor, 0.8);
}
```

**Updated dependencies**:
```tsx
}), [particleSize, theme])  // ✅ Recreate material when theme changes
```

## How It Works

### Dark Mode (Background: Black)
- Particles multiplied by **1.5x** (brighter/emissive)
- Bright colors pop against dark background
- Creates beautiful glowing effect with bloom

### Light Mode (Background: White)
- Particles multiplied by **0.6x** (darkened)
- Colors become visible against white background
- Maintains contrast and readability

### Smooth Transition
- When theme changes, material recreates with new `isLightMode` uniform
- Shader instantly applies new color multiplier
- Particles smoothly adapt to new background

## Technical Details

### Why 1.5x for Dark Mode?
- Creates "emissive" look - particles appear to glow
- Works beautifully with bloom post-processing
- Enhances depth perception in dark environments

### Why 0.6x for Light Mode?
- Darkens colors enough to be visible on white
- Maintains color accuracy (not too dark)
- Preserves image detail and color relationships

### GLSL `mix()` Function
```glsl
mix(darkModeColor, lightModeColor, isLightMode)
```
- `isLightMode = 0.0`: Returns darkModeColor (bright)
- `isLightMode = 1.0`: Returns lightModeColor (dark)
- Efficient GPU lerp/interpolation

## Result
✅ **Dark Mode**: Bright, emissive particles (1.5x brightness) against black  
✅ **Light Mode**: Darkened particles (0.6x brightness) against white  
✅ **Both Modes**: Perfect visibility and contrast  
✅ **Smooth Updates**: Instant color adjustment when toggling theme

Now particles are beautifully visible in both themes! 🎨
