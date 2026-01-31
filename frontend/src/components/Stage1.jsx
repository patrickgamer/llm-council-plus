import { useState, useEffect } from 'react';
import { getModelVisuals, getShortModelName } from '../utils/modelHelpers';
import ThinkBlockRenderer from './ThinkBlockRenderer';
import StageTimer from './StageTimer';
import './Stage1.css';

export default function Stage1({ responses, startTime, endTime }) {
  const [activeTab, setActiveTab] = useState(0);

  // Reset activeTab if it becomes out of bounds
  useEffect(() => {
    if (responses && responses.length > 0 && activeTab >= responses.length) {
      setActiveTab(responses.length - 1);
    }
  }, [responses, activeTab]);

  if (!responses || responses.length === 0) {
    return null;
  }

  const safeActiveTab = Math.min(activeTab, responses.length - 1);
  const currentResponse = responses[safeActiveTab] || {};
  const hasError = currentResponse?.error || false;

  const gridColumns = Math.min(responses.length, 4);

  // Get visuals for current tab
  const currentVisuals = getModelVisuals(currentResponse?.model);

  // Copy functionality
  const [isCopied, setIsCopied] = useState(false);

  // Reset copy state when tab changes
  useEffect(() => {
    setIsCopied(false);
  }, [activeTab]);

  const handleCopy = async () => {
    const textToCopy = typeof currentResponse.response === 'string'
      ? currentResponse.response
      : String(currentResponse.response || '');

    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div className="stage-container stage-1">
      <div className="stage-header">
        <div className="stage-title">
          <span className="stage-icon">💬</span>
          Stage 1: Individual Perspectives
        </div>
        <StageTimer startTime={startTime} endTime={endTime} label="Duration" />
      </div>

      {/* Avatar Tabs */}
      <div
        className="tabs"
        style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}
      >
        {responses.map((resp, index) => {
          const visuals = getModelVisuals(resp?.model);
          const shortName = getShortModelName(resp?.model);

          return (
            <button
              key={index}
              className={`tab ${safeActiveTab === index ? 'active' : ''} ${resp?.error ? 'tab-error' : ''}`}
              onClick={() => setActiveTab(index)}
              style={safeActiveTab === index ? { borderColor: visuals.color, color: visuals.color } : {}}
              title={resp?.model}
            >
              <span className="tab-icon" style={{ backgroundColor: safeActiveTab === index ? 'transparent' : 'rgba(255,255,255,0.1)' }}>
                {visuals.icon}
              </span>
              <span className="tab-name">{shortName}</span>
              {resp?.error && <span className="error-badge">!</span>}
            </button>
          );
        })}
      </div>

      <div className="tab-content glass-panel">
        <div className="model-header">
          <div className="model-identity">
            <span className="model-avatar" style={{ backgroundColor: hasError ? '#ef4444' : currentVisuals.color }}>
              {currentVisuals.icon}
            </span>
            <div className="model-info">
              <span className="model-name-large">{currentResponse.model || 'Unknown Model'}</span>
              <span className="model-provider-badge" style={{ borderColor: currentVisuals.color, color: currentVisuals.color }}>
                {currentVisuals.name}
              </span>
            </div>
          </div>

          <div className="header-actions">
            {!hasError && (
              <button
                className={`copy-button ${isCopied ? 'copied' : ''}`}
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {isCopied ? (
                  <>
                    <span className="icon">✓</span>
                    <span className="label">Copied</span>
                  </>
                ) : (
                  <>
                    <span className="icon">📋</span>
                    <span className="label">Copy</span>
                  </>
                )}
              </button>
            )}

            {hasError ? (
              <span className="model-status error">Failed</span>
            ) : (
              <span className="model-status success">Completed</span>
            )}
          </div>
        </div>

        {hasError ? (
          <div className="response-error">
            <div className="error-icon">⚠️</div>
            <div className="error-details">
              <div className="error-title">Model Failed to Respond</div>
              <div className="error-message">{currentResponse?.error_message || 'Unknown error'}</div>
            </div>
          </div>
        ) : (
          <div className="response-text markdown-content">
            <ThinkBlockRenderer
              content={
                typeof currentResponse.response === 'string'
                  ? currentResponse.response
                  : String(currentResponse.response || 'No response')
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
