import { useState, useEffect, useCallback, useRef } from 'react'
import io from 'socket.io-client'

const useWebRTC = (roomId, userId, localVideoRef, remoteVideoRef) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteUserId, setRemoteUserId] = useState(null)
  const [callState, setCallState] = useState('disconnected')
  
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const isInitializedRef = useRef(false)
  const hasJoinedRoomRef = useRef(false) // ← NEW: Track if already joined room

  const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'https://voip-test.loca.lt/'

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up WebRTC resources...')
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    
    setRemoteUserId(null)
    setCallState('disconnected')
    hasJoinedRoomRef.current = false // ← RESET
  }, [localVideoRef, remoteVideoRef])

  // Initialize Socket.IO
  useEffect(() => {
    if (isInitializedRef.current) return
    
    console.log('🔌 Initializing Socket.IO connection to:', SERVER_URL)
    const newSocket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      timeout: 10000,
      reconnectionAttempts: 5
    })

    newSocket.on('connect', () => {
      console.log('✅ Connected to server')
      setIsConnected(true)
      setCallState('connected')
      
      // JOIN ROOM OTOMATIS ketika socket connected
      if (roomId && userId && !hasJoinedRoomRef.current) {
        console.log('🚀 Auto-joining room after connection:', roomId)
        newSocket.emit('join-room', roomId, userId)
        hasJoinedRoomRef.current = true
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection failed:', error)
      setIsConnected(false)
      setCallState('connection_failed')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason)
      setIsConnected(false)
      setCallState('disconnected')
      hasJoinedRoomRef.current = false // Reset on disconnect
    })

    // Socket event handlers
    const handleUserConnected = (data) => {
      console.log('👤 User connected:', data)
      if (data.userId !== userId) {
        setRemoteUserId(data.userId)
        setCallState('connecting')
        createPeerConnection()
      }
    }

    const handleOffer = async (data) => {
      if (data.from !== userId) {
        console.log('📨 Received offer from:', data.from)
        setRemoteUserId(data.from)
        const pc = createPeerConnection()
        
        await pc.setRemoteDescription(data.offer)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        socket.emit('answer', {
          answer: answer,
          to: data.from,
          from: userId,
          roomId: roomId
        })
      }
    }

    const handleAnswer = async (data) => {
      if (data.from !== userId && peerConnectionRef.current) {
        console.log('📨 Received answer from:', data.from)
        await peerConnectionRef.current.setRemoteDescription(data.answer)
      }
    }

    const handleIceCandidate = async (data) => {
      if (data.from !== userId && peerConnectionRef.current) {
        console.log('🧊 Received ICE candidate from:', data.from)
        await peerConnectionRef.current.addIceCandidate(data.candidate)
      }
    }

    const handleUserDisconnected = (data) => {
      if (data.userId === remoteUserId) {
        console.log('👤 User disconnected:', data.userId)
        cleanup()
      }
    }

    const handleRoomUsers = (data) => {
      console.log('👥 Users in room:', data.users)
      // Jika ada user lain di room, create peer connection
      const otherUsers = data.users.filter(u => u !== userId)
      if (otherUsers.length > 0 && !remoteUserId) {
        setRemoteUserId(otherUsers[0])
        setCallState('connecting')
        createPeerConnection()
      }
    }

    // Register event listeners
    newSocket.on('user-connected', handleUserConnected)
    newSocket.on('offer', handleOffer)
    newSocket.on('answer', handleAnswer)
    newSocket.on('ice-candidate', handleIceCandidate)
    newSocket.on('user-disconnected', handleUserDisconnected)
    newSocket.on('room-users', handleRoomUsers)

    setSocket(newSocket)
    isInitializedRef.current = true

    return () => {
      console.log('🔄 Socket cleanup')
      newSocket.off('user-connected', handleUserConnected)
      newSocket.off('offer', handleOffer)
      newSocket.off('answer', handleAnswer)
      newSocket.off('ice-candidate', handleIceCandidate)
      newSocket.off('user-disconnected', handleUserDisconnected)
      newSocket.off('room-users', handleRoomUsers)
      newSocket.close()
    }
  }, [SERVER_URL, roomId, userId]) // ← ADD roomId, userId sebagai dependencies

  // Initialize Media Stream
  const initMediaStream = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        return localStreamRef.current
      }
      
      console.log('🎥 Initializing media stream...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      localStreamRef.current = stream
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      return stream
    } catch (error) {
      console.error('❌ Error accessing media devices:', error)
      return null
    }
  }, [localVideoRef])

  // Create Peer Connection
  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      console.log('♻️ Reusing existing peer connection')
      return peerConnectionRef.current
    }

    console.log('🔄 Creating new peer connection...')
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    pc.ontrack = (event) => {
      console.log('📹 Remote track received')
      const remoteStream = event.streams[0]
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && remoteUserId) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          to: remoteUserId,
          from: userId,
          roomId: roomId
        })
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('Peer connection state:', pc.connectionState)
      setCallState(pc.connectionState)
    }

    peerConnectionRef.current = pc
    return pc
  }, [socket, remoteUserId, userId, roomId, remoteVideoRef])

  // Start call - SIMPLIFIED
  const startCall = useCallback(async () => {
    if (!roomId || !userId) {
      console.log('❌ Cannot start call: missing roomId or userId')
      return
    }

    console.log('📞 Starting call for:', userId, 'in room:', roomId)
    
    // Initialize media
    await initMediaStream()
    
    // Join room akan terjadi otomatis di socket connect handler
    // karena kita sudah punya roomId dan userId
  }, [roomId, userId, initMediaStream])

  // End call
  const endCall = useCallback(() => {
    console.log('📞 Ending call...')
    cleanup()
    
    if (socket) {
      socket.emit('leave-room', { roomId, userId })
    }
  }, [cleanup, socket, roomId, userId])

  // Auto-start ketika component mount atau roomId berubah
  useEffect(() => {
    if (roomId && userId) {
      console.log('🚀 Auto-starting call for room:', roomId)
      startCall()
    }
  }, [roomId, userId, startCall])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🔄 Component unmounting, cleaning up...')
      cleanup()
    }
  }, [cleanup])

  return {
    isConnected,
    remoteUserId,
    callState,
    startCall,
    endCall
  }
}

export default useWebRTC