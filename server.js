const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer(async (req, res) => {
    // 1. Strip away all CORS blocks so your frontend can talk to it freely
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    // 2. The Server-to-Server Tunnel
    if (req.method === 'POST' && req.url === '/api/tunnel') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        
        req.on('end', async () => {
            try {
                const parsedBody = JSON.parse(body);

                // The backend reaches out to the API, completely invisible to Opera GX
                const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    body: JSON.stringify({
                        url: parsedBody.url,
                        vQuality: parsedBody.vQuality,
                        isAudioOnly: parsedBody.isAudioOnly,
                        filenamePattern: 'classic'
                    })
                });

                const data = await cobaltRes.json();
                
                // Send the clean, unlocked download URL back to your frontend
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
                
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Backend tunnel failed' }));
            }
        });
    } else {
        res.writeHead(200);
        res.end('PulseLoad Tunnel is Active!');
    }
}).listen(PORT, () => console.log(`Server running on ${PORT}`));
