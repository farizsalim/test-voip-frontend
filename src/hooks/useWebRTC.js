import { useState, useEffect, useCallback } from 'react'
import io from 'socket.io-client'

const useWebRTC = (roomId, userId, localVideoRef, remoteVideoRef) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteUserId, setRemoteUserId] = useState(null)
  const [callState, setCallState] = useState('disconnected')
  
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [peerConnection, setPeerConnection] = useState(null)

  const SERVER_URL = 'voip-signal-server.vercel.app'

  // Initialize Socket.IO
  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('Connected to server')
      setIsConnected(true)
      setCallState('connected')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
      setIsConnected(false)
      setCallState('disconnected')
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  // Initialize Media Stream
  const initMediaStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      return stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      return null
    }
  }, [localVideoRef])

  // Create Peer Connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })

    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream)
      })
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0]
      setRemoteStream(remoteStream)
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream
      }
    }

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          to: remoteUserId,
          from: userId,
          roomId: roomId
        })
      }
    }

    pc.onconnectionstatechange = () => {
      setCallState(pc.connectionState)
    }

    setPeerConnection(pc)
    return pc
  }, [localStream, socket, remoteUserId, userId, roomId, remoteVideoRef])

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    const handleUserConnected = (data) => {
      console.log('User connected:', data)
      if (data.userId !== userId) {
        setRemoteUserId(data.userId)
        setCallState('connecting')
      }
    }

    const handleOffer = async (data) => {
      if (data.from !== userId) {
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
      if (data.from !== userId && peerConnection) {
        await peerConnection.setRemoteDescription(data.answer)
      }
    }

    const handleIceCandidate = async (data) => {
      if (data.from !== userId && peerConnection) {
        await peerConnection.addIceCandidate(data.candidate)
      }
    }

    const handleUserDisconnected = (data) => {
      if (data.userId === remoteUserId) {
        setRemoteUserId(null)
        setCallState('disconnected')
        if (peerConnection) {
          peerConnection.close()
          setPeerConnection(null)
        }
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
  }, [socket, userId, roomId, remoteUserId, peerConnection, createPeerConnection])

  // Start call
  const startCall = useCallback(async () => {
    if (!socket || !roomId) return

    // Join room
    socket.emit('join-room', roomId, userId)

    // Initialize media
    const stream = await initMediaStream()
    if (!stream) return

    // Create peer connection if another user is expected
    createPeerConnection()
  }, [socket, roomId, userId, initMediaStream, createPeerConnection])

  // End call
  const endCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
    if (peerConnection) {
      peerConnection.close()
    }
    if (socket) {
      socket.emit('leave-room', { roomId, userId })
      socket.emit('end-call', { roomId, userId })
    }
    setRemoteUserId(null)
    setCallState('disconnected')
  }, [localStream, peerConnection, socket, roomId, userId])

  return {
    isConnected,
    remoteUserId,
    callState,
    startCall,
    endCall
  }
}

export default useWebRTC