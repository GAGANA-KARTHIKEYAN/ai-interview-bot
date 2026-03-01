// src/components/TranscriptionDisplay.tsx (new)
import React from 'react';

export default function TranscriptionDisplay({ text }: { text: string }) {
  return <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>{text}</div>;
}