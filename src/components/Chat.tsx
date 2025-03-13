import React, { FormEvent, useState, useEffect } from 'react';

interface ChatProps {
    socket: WebSocket | null;
}

const Chat = ({ socket }: ChatProps) => {
    const [message, setMessage] = useState<string>('');
    const [chatHistory, setChatHistory] = useState<string[]>([]); // Store messages

    const sendMessage = (event: FormEvent) => {
        event.preventDefault();
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ message }));
            setChatHistory(prev => [...prev, `Me: ${message}`]); // Show sent message
            setMessage('');
        }
    };

    useEffect(() => {
        if (!socket) return;

        const handleMessage = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.message) {
                console.log('Received:', data.message);
                setChatHistory(prev => [...prev, `User: ${data.message}`]);
            }
        };

        socket.addEventListener('message', handleMessage);

        return () => {
            socket.removeEventListener('message', handleMessage);
        };
    }, [socket]);

    return (
        <div className="flex flex-col w-full max-w-md mx-auto bg-white rounded-lg shadow-md p-4">
          {/* Chat Header */}
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Chat</h3>
      
          {/* Chat History */}
          <div className="flex flex-col space-y-2 border border-gray-300 rounded-md p-3 min-h-[150px] max-h-[300px] overflow-y-auto">
            {chatHistory.length > 0 ? (
              chatHistory.map((msg, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-lg text-sm ${
                    index % 2 === 0
                      ? "bg-blue-500 text-white self-start"
                      : "bg-gray-200 text-gray-800 self-end"
                  }`}
                >
                  {msg}
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No messages yet...</p>
            )}
          </div>
      
          {/* Message Input */}
          <form onSubmit={sendMessage} className="flex items-center gap-2 mt-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg 
                        text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type a message..."
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              Send
            </button>
          </form>
        </div>
      );
      
};

export default Chat;
