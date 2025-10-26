import React, { useState } from 'react'

const RoomJoin = ({ onJoinRoom, userId }) => {
  const [roomId, setRoomId] = useState('')

  const handleJoin = (e) => {
    e.preventDefault()
    if (roomId.trim()) {
      onJoinRoom(roomId.trim())
    }
  }

  const createRandomRoom = () => {
    const randomRoom = `room_${Math.random().toString(36).substr(2, 6)}`
    setRoomId(randomRoom)
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="glass-effect rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎯</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Join Call Room</h2>
          <p className="text-white/70 mt-2">Your ID: {userId}</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Room ID
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={createRandomRoom}
              className="flex-1 py-3 px-4 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all duration-200 font-medium"
            >
              Random Room
            </button>
            <button
              type="submit"
              disabled={!roomId.trim()}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Call
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RoomJoin