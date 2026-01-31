import { useState } from 'react';
import { getModelVisuals, getShortModelName } from '../utils/modelHelpers';
import ThinkBlockRenderer from './ThinkBlockRenderer';
import StageTimer from './StageTimer';
import './Stage3.css';

export default function Stage3({ finalResponse, startTime, endTime }) {
    const [isCopied, setIsCopied] = useState(false);

    if (!finalResponse) {
        return null;
    }

    const visuals = getModelVisuals(finalResponse?.model);
    const shortName = getShortModelName(finalResponse?.model);

    const handleCopy = async () => {
        const textToCopy = typeof finalResponse?.response === 'string'
            ? finalResponse.response
            : String(finalResponse?.response || '');

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
        <div className="stage-container stage-3">
            <div className="stage-header">
                <div className="stage-title">
                    <span className="stage-icon">⚖️</span>
                    Stage 3: Final Council Answer
                </div>
                <StageTimer startTime={startTime} endTime={endTime} label="Duration" />
            </div>
            <div className="final-response">
                <div className="chairman-header">
                    <div className="chairman-identity">
                        <span className="chairman-avatar" style={{ backgroundColor: visuals.color }}>
                            {visuals.icon}
                        </span>
                        <div className="chairman-info">
                            <span className="chairman-role">
                                <span>👨‍⚖️</span> Chairman's Verdict
                            </span>
                            <span className="chairman-model">{shortName}</span>
                            <span className="chairman-provider-badge">{visuals.name}</span>
                        </div>
                    </div>

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
                </div>
                <div className="final-text markdown-content">
                    <ThinkBlockRenderer
                        content={
                            typeof finalResponse?.response === 'string'
                                ? finalResponse.response
                                : String(finalResponse?.response || 'No response')
                        }
                    />
                </div>
            </div>
        </div>
    );
}
