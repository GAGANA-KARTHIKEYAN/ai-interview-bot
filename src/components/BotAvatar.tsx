// src/components/BotAvatar.tsx (new)
import React from 'react';

export default function BotAvatar({ speaking }: { speaking: boolean }) {
  return (
    <div style={{
      width: '50px',
      height: '50px',
      borderRadius: '50%',
      background: '#3b82f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: '24px',
      animation: speaking ? 'pulse 1s infinite' : 'none'
    }}>
      AI
    </div>
  );
}