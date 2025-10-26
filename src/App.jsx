import React, { useState } from 'react'
import RoomJoin from './components/RoomJoin'
import CallInterface from './components/CallInterface'

function App() {
  const [currentRoom, setCurrentRoom] = useState(null)
  const [userId] = useState(`user_${Math.random().toString(36).substr(2, 9)}`)

  const joinRoom = (roomId) => {
    setCurrentRoom(roomId)
  }

  const leaveRoom = () => {
    setCurrentRoom(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-white mb-8">
          🎙️ VoIP Call
        </h1>
        
        {!currentRoom ? (
          <RoomJoin onJoinRoom={joinRoom} userId={userId} />
        ) : (
          <CallInterface 
            roomId={currentRoom} 
            userId={userId}
            onLeaveRoom={leaveRoom}
          />
        )}
      </div>
    </div>
  )
}

export default App