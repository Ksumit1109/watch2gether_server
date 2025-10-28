# Watch Together - Backend Server

A real-time synchronization server for watching YouTube videos together with friends. Built with Express, Socket.IO, and YouTube Data API v3.

## Features

- 🎥 Real-time video synchronization (play, pause, seek)
- 💬 Live chat functionality
- 👥 Multi-user room support
- 🔍 YouTube video search integration
- 🎯 Host-based room management
- 🔄 Automatic host transfer on disconnect

## Tech Stack

- **Node.js** - Runtime environment
- **Express** - Web framework
- **Socket.IO** - Real-time bidirectional communication
- **YouTube Data API v3** - Video search functionality
- **CORS** - Cross-origin resource sharing

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- YouTube Data API Key ([Get one here](https://console.cloud.google.com/apis/credentials))

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd server
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the server directory:

```env
PORT=5000
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## Getting YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "YouTube Data API v3"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key to your `.env` file

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:5000` (or your specified PORT).

## API Endpoints

### REST Endpoints

#### Search Videos

```http
GET /api/search?q=search_query&maxResults=10
```

**Query Parameters:**

- `q` (required) - Search query string
- `maxResults` (optional) - Number of results (default: 8, max: 50)

**Response:**

```json
{
  "items": [
    {
      "id": { "videoId": "video_id" },
      "snippet": {
        "title": "Video Title",
        "description": "Video Description",
        "channelTitle": "Channel Name",
        "thumbnails": { ... }
      }
    }
  ]
}
```

#### Health Check

```http
GET /api/ping
```

**Response:**

```json
{ "ok": true }
```

## Socket.IO Events

### Client → Server

| Event          | Payload                  | Description                          |
| -------------- | ------------------------ | ------------------------------------ |
| `create_room`  | -                        | Create a new room and become host    |
| `join_room`    | `{ roomId, username }`   | Join an existing room                |
| `change_video` | `{ videoId, startTime }` | Change the current video             |
| `play`         | `{ time }`               | Play video at specified time         |
| `pause`        | `{ time }`               | Pause video at specified time        |
| `seek`         | `{ time }`               | Seek to specified time               |
| `request_sync` | -                        | Request current playback state       |
| `sync_state`   | `{ toSocket, state }`    | Send playback state to specific user |
| `chat_message` | `{ text }`               | Send a chat message                  |
| `set_username` | `{ username }`           | Update username                      |

### Server → Client

| Event                    | Payload                               | Description                 |
| ------------------------ | ------------------------------------- | --------------------------- |
| `change_video`           | `{ videoId, startTime, by }`          | Video was changed by user   |
| `play`                   | `{ time, by }`                        | Video was played by user    |
| `pause`                  | `{ time, by }`                        | Video was paused by user    |
| `seek`                   | `{ time, by }`                        | Video was seeked by user    |
| `sync_state`             | `{ videoId, currentTime, isPlaying }` | Current playback state      |
| `you_are_host`           | -                                     | You are now the room host   |
| `member_update`          | `{ members }`                         | Member count updated        |
| `chat_message`           | `{ type, user, text, timestamp }`     | New chat message            |
| `request_sync_from_host` | `{ toSocket }`                        | Host should send sync state |

## Room Management

### Room Structure

```javascript
{
  roomId: {
    host: socketId,           // Current host socket ID
    members: Set([socketId])  // Set of all member socket IDs
  }
}
```

### Host Transfer

- When the host disconnects, the first remaining member becomes the new host
- If all members leave, the room is automatically deleted
- New host receives `you_are_host` event

## Error Handling

The server includes error handling for:

- Missing YouTube API key (warning only, search won't work)
- Invalid room IDs when joining
- YouTube API errors
- Socket connection errors

## Environment Variables

| Variable          | Required | Default | Description             |
| ----------------- | -------- | ------- | ----------------------- |
| `PORT`            | No       | 5000    | Server port             |
| `YOUTUBE_API_KEY` | Yes      | -       | YouTube Data API v3 key |

## Development

### Project Structure

```
server/
├── index.js          # Main server file
├── package.json      # Dependencies
├── .env             # Environment variables
└── README.md        # This file
```

### Dependencies

```json
{
  "express": "^4.18.0",
  "socket.io": "^4.6.0",
  "node-fetch": "^3.3.0",
  "cors": "^2.8.5",
  "dotenv": "^16.0.0"
}
```

## Troubleshooting

### YouTube API Not Working

- Verify your API key is correct in `.env`
- Check if YouTube Data API v3 is enabled in Google Cloud Console
- Ensure you haven't exceeded your API quota

### CORS Issues

- The server allows all origins by default
- Modify CORS settings in `index.js` if needed for production

### Socket Connection Issues

- Check if port 5000 is available
- Verify firewall settings
- Ensure frontend is using correct SERVER_URL

## Production Deployment

1. Set environment variables on your hosting platform
2. Use a process manager like PM2:

```bash
npm install -g pm2
pm2 start index.js --name watch-together-server
```

3. Set up reverse proxy with nginx if needed
4. Enable HTTPS for secure connections
5. Configure CORS for your specific domain

## Security Considerations

- Store API keys in environment variables
- Implement rate limiting for production
- Add authentication for private rooms
- Validate all user inputs
- Use HTTPS in production
- Implement room password protection (future enhancement)

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
