import React, { useEffect, useRef, useState } from 'react'
import useWebRTC from '../hooks/useWebRTC'

const CallInterface = ({ roomId, userId, onLeaveRoom }) => {
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)

  const { 
    isConnected, 
    remoteUserId, 
    callState,
    startCall,
    endCall 
  } = useWebRTC(roomId, userId, localVideoRef, remoteVideoRef)

  useEffect(() => {
    startCall()
  }, [startCall])

  const toggleAudio = () => {
    if (localVideoRef.current?.srcObject) {
      const audioTracks = localVideoRef.current.srcObject.getAudioTracks()
      audioTracks.forEach(track => {
        track.enabled = !track.enabled
      })
      setIsAudioMuted(!isAudioMuted)
    }
  }

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const videoTracks = localVideoRef.current.srcObject.getVideoTracks()
      videoTracks.forEach(track => {
        track.enabled = !track.enabled
      })
      setIsVideoOff(!isVideoOff)
    }
  }

  const handleLeaveRoom = () => {
    endCall()
    onLeaveRoom()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="glass-effect rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Room: {roomId}</h2>
            <p className="text-white/70">
              Status: <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
                {callState}
              </span>
              {remoteUserId && ` | Connected with: ${remoteUserId}`}
            </p>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 font-medium"
          >
            Leave Call
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local Video */}
        <div className="glass-effect rounded-2xl p-4">
          <h3 className="text-white font-medium mb-4">You ({userId})</h3>
          <div className="aspect-video bg-black/30 rounded-xl overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Remote Video */}
        <div className="glass-effect rounded-2xl p-4">
          <h3 className="text-white font-medium mb-4">
            {remoteUserId ? `Remote User` : 'Waiting for connection...'}
          </h3>
          <div className="aspect-video bg-black/30 rounded-xl overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteUserId && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-white/50 text-center">
                  <div className="text-4xl mb-2">👤</div>
                  <p>No one connected</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-effect rounded-2xl p-6 mt-6">
        <div className="flex justify-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-all duration-200 ${
              isAudioMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isAudioMuted ? '🔇' : '🎤'}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-all duration-200 ${
              isVideoOff 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isVideoOff ? '📷 Off' : '📹 On'}
          </button>

          <button
            onClick={handleLeaveRoom}
            className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200"
          >
            📞 End
          </button>
        </div>
      </div>
    </div>
  )
}

export default CallInterface