import { useState, useEffect } from 'react';
import { authService } from '../../services/AuthService';
import { config } from '../../config';
import '../../styles/adminPanel.css';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'conversations'
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // User CRUD states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ email: '', username: '', password: '', role: 'user' });
  
  // Conversation states
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  
  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/admin/users`, {
        headers: authService.getAuthHeader()
      });
      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required');
          return;
        }
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/admin/conversations`, {
        headers: authService.getAuthHeader()
      });
      if (!response.ok) {
        if (response.status === 403) {
          setError('Admin access required');
          return;
        }
        throw new Error('Failed to fetch conversations');
      }
      const data = await response.json();
      setConversations(data);
    } catch (err) {
      setError(err.message);
    }
  };
  
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      await fetchUsers();
      await fetchConversations();
      setLoading(false);
    };
    loadData();
  }, []);
  
  // User CRUD handlers
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify(userForm)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create user');
      }
      await fetchUsers();
      setShowUserModal(false);
      setUserForm({ email: '', username: '', password: '', role: 'user' });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader()
        },
        body: JSON.stringify(userForm)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update user');
      }
      await fetchUsers();
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ email: '', username: '', password: '', role: 'user' });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their conversations.')) {
      return;
    }
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeader()
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete user');
      }
      await fetchUsers();
      await fetchConversations();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      username: user.username,
      password: '',
      role: user.role
    });
    setShowUserModal(true);
  };
  
  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ email: '', username: '', password: '', role: 'user' });
    setShowUserModal(true);
  };
  
  // Conversation handlers
  const handleViewConversation = async (convId) => {
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/admin/conversations/${convId}`, {
        headers: authService.getAuthHeader()
      });
      if (!response.ok) throw new Error('Failed to fetch conversation');
      const data = await response.json();
      setSelectedConversation(data);
      setShowConversationModal(true);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleDeleteConversation = async (convId) => {
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/admin/conversations/${convId}`, {
        method: 'DELETE',
        headers: authService.getAuthHeader()
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete conversation');
      }
      await fetchConversations();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };
  
  if (loading) {
    return <div className="admin-loading">Loading admin panel...</div>;
  }
  
  if (error && error === 'Admin access required') {
    return <div className="admin-error">Access Denied: Admin privileges required</div>;
  }
  
  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <div className="admin-tabs">
          <button 
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            Users ({users.length})
          </button>
          <button 
            className={activeTab === 'conversations' ? 'active' : ''}
            onClick={() => setActiveTab('conversations')}
          >
            Conversations ({conversations.length})
          </button>
        </div>
      </div>
      
      {error && <div className="admin-error-banner">{error}</div>}
      
      {activeTab === 'users' && (
        <div className="admin-content">
          <div className="admin-actions">
            <button className="btn-primary" onClick={openCreateUser}>
              + Create User
            </button>
          </div>
          
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Username</th>
                <th>Role</th>
                <th>Conversations</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.username}</td>
                  <td>
                    <span className={`role-badge role-${user.role}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.conversation_count}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-edit" onClick={() => openEditUser(user)}>Edit</button>
                    <button className="btn-delete" onClick={() => handleDeleteUser(user.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {activeTab === 'conversations' && (
        <div className="admin-content">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Agent</th>
                <th>Score</th>
                <th>Tier</th>
                <th>Messages</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map(conv => (
                <tr key={conv.id}>
                  <td>{conv.id}</td>
                  <td>
                    <div>
                      <div>{conv.user_username}</div>
                      <small>{conv.user_email}</small>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div>{conv.agent_name}</div>
                      <small>{conv.agent_role}</small>
                    </div>
                  </td>
                  <td>
                    {conv.final_score !== null ? (
                      <span className={`score-badge score-${conv.tier?.toLowerCase() || 'none'}`}>
                        {Math.round(conv.final_score)}
                      </span>
                    ) : (
                      <span className="score-badge">-</span>
                    )}
                  </td>
                  <td>{conv.tier || '-'}</td>
                  <td>{conv.message_count}</td>
                  <td>{new Date(conv.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-view" onClick={() => handleViewConversation(conv.id)}>View</button>
                    <button className="btn-delete" onClick={() => handleDeleteConversation(conv.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* User Modal */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password {editingUser && '(leave blank to keep current)'}</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required={!editingUser}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Conversation Detail Modal */}
      {showConversationModal && selectedConversation && (
        <div className="modal-overlay" onClick={() => setShowConversationModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <h2>Conversation Details</h2>
            <div className="conversation-detail">
              <div className="detail-section">
                <h3>User Info</h3>
                <p><strong>Email:</strong> {selectedConversation.user_email}</p>
                <p><strong>Username:</strong> {selectedConversation.user_username}</p>
              </div>
              
              <div className="detail-section">
                <h3>Agent Info</h3>
                <p><strong>Agent:</strong> {selectedConversation.agent_name}</p>
                <p><strong>Role:</strong> {selectedConversation.agent_role}</p>
              </div>
              
              {selectedConversation.final_score !== null && (
                <div className="detail-section">
                  <h3>Score</h3>
                  <p><strong>Final Score:</strong> {Math.round(selectedConversation.final_score)}/100</p>
                  <p><strong>Tier:</strong> {selectedConversation.tier}</p>
                  {selectedConversation.detailed_feedback && (
                    <div>
                      <strong>Feedback:</strong>
                      <p>{selectedConversation.detailed_feedback}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="detail-section">
                <h3>Messages ({selectedConversation.messages.length})</h3>
                <div className="messages-list">
                  {selectedConversation.messages.map(msg => (
                    <div key={msg.id} className={`message-item message-${msg.sender}`}>
                      <strong>{msg.sender === 'user' ? 'User' : 'Agent'}:</strong>
                      <p>{msg.text}</p>
                      <small>{new Date(msg.timestamp_ms).toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowConversationModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

