import React, { useEffect, useRef, useState } from 'react';

const SERVER_URL = "wss://zing-signaling-socket-production.up.railway.app";

const P2PVideochat = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
    const signalingSocket = useRef<WebSocket | null>(null);

    useEffect(() => {
        console.log("Initializing WebSocket connection...");
        if (!signalingSocket.current) {
            signalingSocket.current = new WebSocket(SERVER_URL);
        }

        signalingSocket.current.onmessage = async (message) => {
            const data = JSON.parse(message.data);
            console.log("Received message:", data);

            if (data.offer) {
                console.log("Received Offer");
                await handleOffer(data.offer);
            } else if (data.answer) {
                console.log("Received Answer");
                if (peerConnection) {
                    console.log("setting answer")
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            } else if (data.candidate) {
                console.log("Received ICE Candidate");
                if (peerConnection) {
                    console.log("setting ice candidates")
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
        };

        signalingSocket.current.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        signalingSocket.current.onclose = () => {
            console.warn("Signaling server connection closed.");
        };

       // return () => signalingSocket.current?.close();
    }, [peerConnection]);

    const initializePeerConnection = async () => {
        const pc = new RTCPeerConnection({
            iceServers: [{
                urls: "stun:stun.l.google.com:19302"
            }]
        });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate && signalingSocket.current) {
                console.log("found ice candidate: " + event.candidate.candidate)
                signalingSocket.current.send(JSON.stringify({ candidate: event.candidate }));
            }
        };

        pc.ontrack = (event) => {
            console.log("Received remote track:", event.streams[0]);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        setPeerConnection(pc);
        return pc;
    };

    const startCall = async () => {
        const pc = await initializePeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (signalingSocket.current) {
            signalingSocket.current.send(JSON.stringify({ offer }));
        }
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
        const pc = await initializePeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (signalingSocket.current) {
            signalingSocket.current.send(JSON.stringify({ answer }));
        }
    };

    return (
        <div>
            <h2>P2P Video Chat</h2>
            <video ref={localVideoRef} autoPlay playsInline style={{ width: '300px' }} />
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '300px' }} />
            <button onClick={startCall}>Start Call</button>
        </div>
    );
};

export default P2PVideochat;
