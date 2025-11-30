export function Controls({
  onCreateSession,
  onStartSession,
  onChangeVoice,
  onCloseSession,
  onManageSessions,
  onCloseAllSessions,
  onSendTask,
  onTalk,
  taskInput,
  onTaskInputChange,
  isConnected,
  hasSession,
}) {
  return (
    <>
      <div className="actionRow">
        <button id="newBtn" onClick={onCreateSession}>
          New
        </button>
        <button id="startBtn" onClick={onStartSession} disabled={!hasSession || isConnected}>
          Start
        </button>
        <button id="changeVoiceBtn" onClick={onChangeVoice}>
          Change Voice
        </button>
        <button id="closeBtn" onClick={onCloseSession} disabled={!hasSession}>
          Close
        </button>
        <button id="manageSessionsBtn" onClick={onManageSessions} title="List and close existing sessions">
          Manage Sessions
        </button>
        <button id="closeAllSessionsBtn" onClick={onCloseAllSessions} title="Close all active sessions">
          Close All Sessions
        </button>
      </div>

      <div className="actionRow">
        <label>
          Message
          <input
            id="taskInput"
            type="text"
            value={taskInput}
            onChange={(e) => onTaskInputChange(e.target.value)}
          />
        </label>
        <button id="repeatBtn" onClick={onSendTask} disabled={!isConnected}>
          Repeat
        </button>
        <button id="talkBtn" onClick={onTalk} disabled={!isConnected}>
          Talk
        </button>
      </div>
    </>
  );
}

