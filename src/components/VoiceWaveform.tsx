// src/components/VoiceWaveform.tsx (new)
import React from 'react';

export default function VoiceWaveform({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {[10, 20, 30, 20, 10].map((h, i) => (
        <div key={i} style={{
          width: '4px',
          height: `${h}px`,
          background: '#3b82f6',
          animation: 'wave 0.5s infinite alternate',
          animationDelay: `${i * 0.1}s`
        }}></div>
      ))}
    </div>
  );
}