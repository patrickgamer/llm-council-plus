import React, { useState } from 'react';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onOpenSettings,
  isLoading,
  onAbort,
  isOpen,
  onClose
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations by title
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery.trim()) return true;
    const title = conv.title || 'New Conversation';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleAbortClick = (e) => {
    e.stopPropagation();
    onAbort();
  };

  const handleDeleteClick = (e, convId) => {
    e.stopPropagation();
    setConfirmingDelete(convId);
  };

  const handleConfirmDelete = (e, convId) => {
    e.stopPropagation();
    onDeleteConversation(convId);
    setConfirmingDelete(null);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmingDelete(null);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Mobile close button */}
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
          ×
        </button>
        
        <div className="sidebar-header">
        <div className="sidebar-title-wrapper">
          <div className="sidebar-title">LLM Council <span className="title-plus">Plus</span></div>
          <div className="sidebar-subtitle">Created by: Jacob Ben-David</div>
        </div>
        <button
          className="icon-button"
          onClick={onOpenSettings}
          title="Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Prominent New Discussion Button */}
      <div className="sidebar-actions">
        <button
          className="new-council-btn"
          onClick={onNewConversation}
          disabled={isLoading}
        >
          <span className="btn-icon">+</span>
          <span className="btn-text">New Discussion</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="sidebar-search">
        <input
          type="text"
          className="search-input"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            className="search-clear" 
            onClick={() => setSearchQuery('')}
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      <div className="conversation-list">
        {filteredConversations.length === 0 ? (
          <div className="sidebar-empty-state">
            {searchQuery ? 'No matching conversations' : 'No history'}
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-title">
                {conv.title || 'New Conversation'}
              </div>
              <div className="conversation-meta">
                <span>{new Date(conv.created_at).toLocaleDateString()}</span>
                {isLoading && conv.id === currentConversationId ? (
                  <button className="stop-generation-btn small" onClick={handleAbortClick}>
                    Stop
                  </button>
                ) : confirmingDelete === conv.id ? (
                  <div className="delete-confirm">
                    <button
                      className="confirm-yes-btn"
                      onClick={(e) => handleConfirmDelete(e, conv.id)}
                      title="Confirm delete"
                    >
                      ✓
                    </button>
                    <button
                      className="confirm-no-btn"
                      onClick={handleCancelDelete}
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDeleteClick(e, conv.id)}
                    title="Delete conversation"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
}
