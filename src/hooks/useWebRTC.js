import { useState, useEffect, useCallback, useRef } from 'react'
import io from 'socket.io-client'

const useWebRTC = (roomId, userId, localVideoRef, remoteVideoRef) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteUserId, setRemoteUserId] = useState(null)
  const [callState, setCallState] = useState('disconnected')
  
  // Gunakan useRef untuk values yang perlu persist across re-renders
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const isInitializedRef = useRef(false)

  const SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'https://voip-signal-server.vercel.app'

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up WebRTC resources...')
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    
    setRemoteUserId(null)
    setCallState('disconnected')
    isInitializedRef.current = false
  }, [localVideoRef, remoteVideoRef])

  // Initialize Socket.IO - HANYA SEKALI
  useEffect(() => {
    if (isInitializedRef.current) return
    
    console.log('🔌 Initializing Socket.IO connection...')
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnectionAttempts: 3
    })

    newSocket.on('connect', () => {
      console.log('✅ Connected to server')
      setIsConnected(true)
      setCallState('connected')
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
    })

    setSocket(newSocket)
    isInitializedRef.current = true

    return () => {
      console.log('🔄 Socket cleanup')
      newSocket.close()
    }
  }, [SERVER_URL])

  // Initialize Media Stream - HANYA SEKALI
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

  // Create Peer Connection - HANYA SATU
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

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📹 Remote track received')
      const remoteStream = event.streams[0]
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
    }

    // ICE candidate handling
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

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState)
    }

    peerConnectionRef.current = pc
    return pc
  }, [socket, remoteUserId, userId, roomId, remoteVideoRef])

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    const handleUserConnected = (data) => {
      console.log('👤 User connected:', data)
      if (data.userId !== userId) {
        setRemoteUserId(data.userId)
        setCallState('connecting')
        // Create peer connection when remote user connects
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
        console.log('📤 Sent answer to:', data.from)
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
        setRemoteUserId(null)
        setCallState('disconnected')
        cleanup()
      }
    }

    socket.on('user-connected', handleUserConnected)
    socket.on('offer', handleOffer)
    socket.on('answer', handleAnswer)
    socket.on('ice-candidate', handleIceCandidate)
    socket.on('user-disconnected', handleUserDisconnected)

    return () => {
      socket.off('user-connected', handleUserConnected)
      socket.off('offer', handleOffer)
      socket.off('answer', handleAnswer)
      socket.off('ice-candidate', handleIceCandidate)
      socket.off('user-disconnected', handleUserDisconnected)
    }
  }, [socket, userId, roomId, remoteUserId, createPeerConnection, cleanup])

  // Start call
  const startCall = useCallback(async () => {
    if (!socket || !roomId) {
      console.log('❌ Cannot start call: missing socket or roomId')
      return
    }

    console.log('📞 Starting call in room:', roomId)
    
    // Join room first
    socket.emit('join-room', roomId, userId)
    console.log('✅ Joined room:', roomId)

    // Initialize media
    const stream = await initMediaStream()
    if (!stream) {
      console.log('❌ Failed to get media stream')
      return
    }

    console.log('✅ Media stream initialized')
  }, [socket, roomId, userId, initMediaStream])

  // End call
  const endCall = useCallback(() => {
    console.log('📞 Ending call...')
    cleanup()
    
    if (socket) {
      socket.emit('leave-room', { roomId, userId })
      socket.emit('end-call', { roomId, userId })
    }
  }, [cleanup, socket, roomId, userId])

  // Cleanup on unmount or room change
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