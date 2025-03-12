import React, { useEffect, useRef, useState } from 'react';

const SERVER_URL = "wss://zing-signaling-socket-production.up.railway.app";

const P2PVideochat = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const signalingSocket = useRef<WebSocket | null>(null);
    const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([]);

    const [isCallActive, setIsCallActive] = useState(false);

    useEffect(() => {
        console.log("Initializing WebSocket connection...");

        if (!signalingSocket.current) {
            signalingSocket.current = new WebSocket(SERVER_URL);
        }

        signalingSocket.current.onopen = () => console.log("WebSocket connected ✅");

        signalingSocket.current.onmessage = async (message) => {
            const data = JSON.parse(message.data);
            console.log("Received message:", data);

            try {
                if (data.offer) {
                    console.log("Received Offer");
                    await handleOffer(data.offer);
                } else if (data.answer) {
                    console.log("Received Answer");
                    if (peerConnectionRef.current) {
                        if(!peerConnectionRef.current?.remoteDescription) await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    }
                } else if (data.candidate) {
                    console.log("Received ICE Candidate");
                    if (peerConnectionRef.current?.remoteDescription) {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } else {
                        iceCandidateQueue.current.push(data.candidate);
                    }
                }
            } catch (error) {
                console.error("Error processing WebSocket message:", error);
            }
        };

        signalingSocket.current.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        signalingSocket.current.onclose = () => {
            console.warn("Signaling server connection closed. Attempting to reconnect...");
            setTimeout(() => {
                signalingSocket.current = new WebSocket(SERVER_URL);
            }, 2000);
        };

        
    }, []);

    const initializePeerConnection = async () => {
        if (peerConnectionRef.current) {
            console.warn("PeerConnection already exists!");
            return peerConnectionRef.current;
        }

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate && signalingSocket.current) {
                signalingSocket.current.send(JSON.stringify({ candidate: event.candidate }));
            }
        };

        pc.ontrack = (event) => {
            console.log("Received remote track:", event.streams[0]);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        pc.onconnectionstatechange = () => {
            console.log("Connection state:", pc.connectionState);
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                console.warn("Peer disconnected! Ending call...");
                endCall();
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    };

    const startCall = async () => {
        if (isCallActive) {
            console.warn("Call already in progress!");
            return;
        }

        const pc = await initializePeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (signalingSocket.current) {
            signalingSocket.current.send(JSON.stringify({ offer }));
        }

        setIsCallActive(true);
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
        if (isCallActive) {
            console.warn("Already in a call, ignoring new offer.");
            return;
        }

        const pc = await initializePeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (signalingSocket.current) {
            signalingSocket.current.send(JSON.stringify({ answer }));
        }

        setIsCallActive(true);

        // Apply any queued ICE candidates
        while (iceCandidateQueue.current.length > 0) {
            const candidate = iceCandidateQueue.current.shift();
            if (candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
        }
    };

    const endCall = () => {
        console.log("Ending call...");

        if (peerConnectionRef.current) {
            peerConnectionRef.current.getSenders().forEach(sender => peerConnectionRef.current?.removeTrack(sender));
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (localVideoRef.current?.srcObject) {
            (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            localVideoRef.current.srcObject = null;
        }

        if (remoteVideoRef.current?.srcObject) {
            (remoteVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            remoteVideoRef.current.srcObject = null;
        }

        setIsCallActive(false);

        if (signalingSocket.current) {
            signalingSocket.current.send(JSON.stringify({ type: "endCall" }));
        }
    };

    return (
        <div>
            <h2>P2P Video Chat</h2>
            <video ref={localVideoRef} autoPlay playsInline style={{ width: '300px' }} />
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px' }} />
            {!isCallActive ? (
                <button onClick={startCall}>Start Call</button>
            ) : (
                <button onClick={endCall}>End Call</button>
            )}
        </div>
    );
};

export default P2PVideochat;
