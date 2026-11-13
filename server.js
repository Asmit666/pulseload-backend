const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    if (req.method === 'POST' && req.url === '/api/tunnel') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        
        req.on('end', async () => {
            try {
                const parsedBody = JSON.parse(body);
                const ytUrl = parsedBody.url;
                
                // Extract the exact 11-character Video ID
                const videoIdMatch = ytUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
                if (!videoIdMatch) throw new Error('Invalid YouTube link');
                
                const videoId = videoIdMatch[1];

                // Fetch directly from the Piped proxy network (Datacenter IPs allowed)
                const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
                const pipedData = await pipedRes.json();
                
                if (pipedData.error) throw new Error(pipedData.error);

                let streamUrl = null;
                if (parsedBody.isAudioOnly) {
                    const audios = pipedData.audioStreams.sort((a, b) => b.bitrate - a.bitrate);
                    if (audios.length > 0) streamUrl = audios[0].url;
                } else {
                    // Filter out muted tracks and grab the highest quality merged video+audio
                    const videos = pipedData.videoStreams.filter(v => !v.videoOnly).sort((a, b) => b.bitrate - a.bitrate);
                    if (videos.length > 0) streamUrl = videos[0].url;
                }

                if (streamUrl) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ url: streamUrl }));
                } else {
                    throw new Error('No compatible stream found');
                }
            } catch (err) {
                console.error("Tunnel Error:", err.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    } else {
        res.writeHead(200);
        res.end('PulseLoad Tunnel is Active!');
    }
}).listen(PORT, () => console.log(`Server running on ${PORT}`));
