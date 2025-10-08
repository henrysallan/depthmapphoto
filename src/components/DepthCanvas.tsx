import React from 'react'

export function DepthCanvas({ src }: { src: string }) {
  // This component is currently unused (depth is shown as <img>),
  // but kept for potential future enhancements (e.g., color maps).
  return <img src={src} alt="depth" />
}
