import React, { useState, useEffect } from 'react';

interface Comment {
  id: string;
  name: string;
  email?: string;
  comment: string;
  timestamp: Date;
}

interface CommentsSectionProps {
  storageKey: string;
  title?: string;
  description?: string;
}

const CommentsSection: React.FC<CommentsSectionProps> = ({ 
  storageKey, 
  title = "Comments & Discussion",
  description = "Share your thoughts or ask questions!"
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState({
    name: '',
    email: '',
    comment: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState({
    name: '',
    email: '',
    comment: ''
  });

  // Load comments from localStorage on component mount
  useEffect(() => {
    const savedComments = localStorage.getItem(storageKey);
    if (savedComments) {
      try {
        const parsedComments = JSON.parse(savedComments);
        // Convert timestamp strings back to Date objects
        const commentsWithDates = parsedComments.map((comment: any) => ({
          ...comment,
          timestamp: new Date(comment.timestamp)
        }));
        setComments(commentsWithDates);
      } catch (error) {
        console.error('Error loading comments:', error);
      }
    }
  }, [storageKey]);

  // Save comments to localStorage whenever comments change
  useEffect(() => {
    if (comments.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(comments));
    }
  }, [comments, storageKey]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.name.trim() || !newComment.comment.trim()) {
      alert('Please fill in your name and comment.');
      return;
    }

    setIsSubmitting(true);

    const comment: Comment = {
      id: Date.now().toString() + Math.random().toString(36),
      name: newComment.name.trim(),
      email: newComment.email.trim(),
      comment: newComment.comment.trim(),
      timestamp: new Date()
    };

    setComments(prev => [comment, ...prev]);
    setNewComment({ name: '', email: '', comment: '' });
    setIsSubmitting(false);
  };

  const handleEditComment = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      setEditingCommentId(commentId);
      setEditingComment({
        name: comment.name,
        email: comment.email || '',
        comment: comment.comment
      });
    }
  };

  const handleSaveEdit = () => {
    if (!editingComment.name.trim() || !editingComment.comment.trim()) {
      alert('Please fill in your name and comment.');
      return;
    }

    setComments(prev => prev.map(comment => 
      comment.id === editingCommentId 
        ? {
            ...comment,
            name: editingComment.name.trim(),
            email: editingComment.email.trim(),
            comment: editingComment.comment.trim()
          }
        : comment
    ));

    setEditingCommentId(null);
    setEditingComment({ name: '', email: '', comment: '' });
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingComment({ name: '', email: '', comment: '' });
  };

  const handleDeleteComment = (commentId: string) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      
      // If we're editing this comment, cancel the edit
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingComment({ name: '', email: '', comment: '' });
      }
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <section className="project-section">
      <h2>{title}</h2>
      <p>{description}</p>
      
      {/* Comment Form */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#800000' }}>Leave a Comment</h3>
        <form onSubmit={handleCommentSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Name *
            </label>
            <input
              type="text"
              value={newComment.name}
              onChange={(e) => setNewComment(prev => ({ ...prev, name: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              placeholder="Your name"
              required
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Email (optional)
            </label>
            <input
              type="email"
              value={newComment.email}
              onChange={(e) => setNewComment(prev => ({ ...prev, email: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              placeholder="your.email@example.com"
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Comment *
            </label>
            <textarea
              value={newComment.comment}
              onChange={(e) => setNewComment(prev => ({ ...prev, comment: e.target.value }))}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                resize: 'vertical'
              }}
              placeholder="Share your thoughts, insights, or questions..."
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              backgroundColor: '#800000',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      </div>

      {/* Comments Display */}
      <div>
        <h3 style={{ marginBottom: '20px', color: '#800000' }}>
          Comments ({comments.length})
        </h3>
        
        {comments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            fontStyle: 'italic',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            No comments yet. Be the first to share your thoughts!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: '20px',
                  backgroundColor: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {editingCommentId === comment.id ? (
                  // Edit Mode
                  <div>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Name *
                      </label>
                      <input
                        type="text"
                        value={editingComment.name}
                        onChange={(e) => setEditingComment(prev => ({ ...prev, name: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        required
                      />
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={editingComment.email}
                        onChange={(e) => setEditingComment(prev => ({ ...prev, email: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
                        Comment *
                      </label>
                      <textarea
                        value={editingComment.comment}
                        onChange={(e) => setEditingComment(prev => ({ ...prev, comment: e.target.value }))}
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '6px 10px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '14px',
                          resize: 'vertical'
                        }}
                        required
                      />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleSaveEdit}
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          padding: '8px 16px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          backgroundColor: '#6c757d',
                          color: 'white',
                          padding: '8px 16px',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div>
                        <strong style={{ color: '#800000', fontSize: '16px' }}>
                          {comment.name}
                        </strong>
                        {comment.email && (
                          <span style={{ color: '#666', fontSize: '14px', marginLeft: '10px' }}>
                            ({comment.email})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ color: '#666', fontSize: '12px' }}>
                          {formatTimestamp(comment.timestamp)}
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEditComment(comment.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#007bff',
                              fontSize: '12px',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              textDecoration: 'underline'
                            }}
                            onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f8f9fa'}
                            onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            style={{
                              backgroundColor: 'transparent',
                              border: 'none',
                              color: '#dc3545',
                              fontSize: '12px',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              textDecoration: 'underline'
                            }}
                            onMouseOver={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#f8f9fa'}
                            onMouseOut={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{
                      lineHeight: '1.6',
                      color: '#333',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {comment.comment}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CommentsSection;
