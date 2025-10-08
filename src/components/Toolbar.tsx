import React from 'react'

export function Toolbar({ 
  displacementScale, 
  onScaleChange, 
  loading, 
  useMock, 
  onToggleMock, 
  renderMode, 
  onRenderModeChange,
  bloomIntensity,
  onBloomIntensityChange,
  enableBloom,
  onToggleBloom,
  particleDensity,
  onParticleDensityChange,
  particleSize,
  onParticleSizeChange,
  animateParticles,
  onToggleAnimation,
  noiseType,
  onNoiseTypeChange,
  animationSpeed,
  onAnimationSpeedChange,
  noiseIntensity,
  onNoiseIntensityChange,
  emissionMode,
  onToggleEmission
}: {
  displacementScale: number
  onScaleChange: (v: number) => void
  loading: boolean
  useMock: boolean
  onToggleMock: (v: boolean) => void
  renderMode: 'mesh' | 'particles'
  onRenderModeChange: (mode: 'mesh' | 'particles') => void
  bloomIntensity: number
  onBloomIntensityChange: (v: number) => void
  enableBloom: boolean
  onToggleBloom: (v: boolean) => void
  particleDensity: number
  onParticleDensityChange: (v: number) => void
  particleSize: number
  onParticleSizeChange: (v: number) => void
  animateParticles: boolean
  onToggleAnimation: (v: boolean) => void
  noiseType: 'perlin' | 'curl'
  onNoiseTypeChange: (type: 'perlin' | 'curl') => void
  animationSpeed: number
  onAnimationSpeedChange: (v: number) => void
  noiseIntensity: number
  onNoiseIntensityChange: (v: number) => void
  emissionMode: boolean
  onToggleEmission: (v: boolean) => void
}) {
  return (
    <div className="toolbar">
      <label>
        DISPLACEMENT: {(displacementScale).toFixed(3)}
        <input
          type="range"
          min={0}
          max={2.0}
          step={0.01}
          value={displacementScale}
          onChange={(e) => onScaleChange(parseFloat(e.target.value))}
          disabled={loading}
        />
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={useMock}
          onChange={(e) => onToggleMock(e.target.checked)}
          disabled={loading}
        />
        MOCK_DEPTH
      </label>
      
      <label>
        RENDER_MODE:
        <select 
          value={renderMode} 
          onChange={(e) => onRenderModeChange(e.target.value as 'mesh' | 'particles')}
          disabled={loading}
          style={{ 
            background: '#222', 
            color: '#ccc', 
            border: '1px solid #444', 
            borderRadius: '4px',
            padding: '4px 8px',
            marginLeft: '8px',
            fontFamily: 'inherit',
            fontSize: '12px'
          }}
        >
          <option value="mesh">MESH</option>
          <option value="particles">PARTICLES</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={enableBloom}
          onChange={(e) => onToggleBloom(e.target.checked)}
          disabled={loading}
        />
        BLOOM_EFFECT
      </label>

      {renderMode === 'particles' && (
        <label>
          <input
            type="checkbox"
            checked={emissionMode}
            onChange={(e) => onToggleEmission(e.target.checked)}
            disabled={loading}
          />
          EMISSION_MODE
        </label>
      )}

      {enableBloom && (
        <label>
          BLOOM_INTENSITY:
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            value={bloomIntensity}
            onChange={(e) => onBloomIntensityChange(parseFloat(e.target.value))}
            disabled={loading}
            style={{
              marginLeft: '8px',
              marginRight: '8px',
              width: '100px'
            }}
          />
          <span style={{ color: '#ff7043', fontSize: '11px' }}>
            {bloomIntensity.toFixed(1)}
          </span>
        </label>
      )}

      {renderMode === 'particles' && (
        <>
          <label>
            PARTICLE_DENSITY:
            <input
              type="range"
              min="64"
              max="512"
              step="64"
              value={particleDensity}
              onChange={(e) => onParticleDensityChange(parseInt(e.target.value))}
              disabled={loading}
              style={{
                marginLeft: '8px',
                marginRight: '8px',
                width: '100px'
              }}
            />
            <span style={{ color: '#64ffda', fontSize: '11px' }}>
              {particleDensity}x{particleDensity}
            </span>
          </label>

          <label>
            PARTICLE_SIZE:
            <input
              type="range"
              min="0.001"
              max="0.01"
              step="0.0005"
              value={particleSize}
              onChange={(e) => onParticleSizeChange(parseFloat(e.target.value))}
              disabled={loading}
              style={{
                marginLeft: '8px',
                marginRight: '8px',
                width: '100px'
              }}
            />
            <span style={{ color: '#64ffda', fontSize: '11px' }}>
              {(particleSize * 1000).toFixed(1)}
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={animateParticles}
              onChange={(e) => onToggleAnimation(e.target.checked)}
              disabled={loading}
            />
            ANIMATE_PARTICLES
          </label>

          {animateParticles && (
            <>
              <label>
                NOISE_TYPE:
                <select 
                  value={noiseType} 
                  onChange={(e) => onNoiseTypeChange(e.target.value as 'perlin' | 'curl')}
                  disabled={loading}
                  style={{ 
                    background: '#222', 
                    color: '#ccc', 
                    border: '1px solid #444', 
                    borderRadius: '4px',
                    padding: '4px 8px',
                    marginLeft: '8px',
                    fontFamily: 'inherit',
                    fontSize: '12px'
                  }}
                >
                  <option value="perlin">PERLIN</option>
                  <option value="curl">CURL</option>
                </select>
              </label>

              <label>
                ANIM_SPEED:
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={animationSpeed}
                  onChange={(e) => onAnimationSpeedChange(parseFloat(e.target.value))}
                  disabled={loading}
                  style={{
                    marginLeft: '8px',
                    marginRight: '8px',
                    width: '100px'
                  }}
                />
                <span style={{ color: '#7c4dff', fontSize: '11px' }}>
                  {animationSpeed.toFixed(1)}x
                </span>
              </label>

              <label>
                NOISE_INTENSITY:
                <input
                  type="range"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={noiseIntensity}
                  onChange={(e) => onNoiseIntensityChange(parseFloat(e.target.value))}
                  disabled={loading}
                  style={{
                    marginLeft: '8px',
                    marginRight: '8px',
                    width: '100px'
                  }}
                />
                <span style={{ color: '#7c4dff', fontSize: '11px' }}>
                  {noiseIntensity.toFixed(2)}
                </span>
              </label>
            </>
          )}
        </>
      )}
    </div>
  )
}
