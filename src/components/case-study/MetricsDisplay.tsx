import React from 'react';

interface MetricsProps {
  documentCount: number;
  characterLimits: {
    laws: number;
    cases: number;
  };
  rerankedK: number;
}

export const MetricsDisplay: React.FC<MetricsProps> = ({
  documentCount,
  characterLimits,
  rerankedK
}) => {
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs">
      <div>📁 Docs: {documentCount}</div>
      <div>⚖️ Law chars: {characterLimits.laws}</div>
      <div>📚 Case chars: {characterLimits.cases}</div>
      <div>🎯 Rerank K: {rerankedK}</div>
    </div>
  );
};
