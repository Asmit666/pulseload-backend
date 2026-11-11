const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

function fetchVideo(videoUrl, res, filename, redirectCount = 0) {
    if (redirectCount > 5) {
        res.writeHead(500);
        return res.end('Too many redirects');
    }

    // Disguise the Node server as a real Google Chrome browser
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Connection': 'keep-alive'
        }
    };

    https.get(videoUrl, options, (streamRes) => {
        // 1. Follow forwarding addresses
        if (streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
            return fetchVideo(streamRes.headers.location, res, filename, redirectCount + 1);
        }

        // 2. STOP if the CDN rejects the request (prevents unplayable 0-byte files)
        if (streamRes.statusCode !== 200) {
            console.error(`CDN Blocked Request. Status: ${streamRes.statusCode}`);
            res.writeHead(streamRes.statusCode);
            return res.end(`Download blocked by media server (Status ${streamRes.statusCode}). IP might be restricted.`);
        }

        // 3. Pipe the actual heavy video data
        res.writeHead(200, {
            'Content-Type': streamRes.headers['content-type'] || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
        });
        
        streamRes.pipe(res);
    }).on('error', () => {
        res.writeHead(500);
        res.end('Download failed due to network error');
    });
}

http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (reqUrl.pathname === '/ping') {
        res.writeHead(200);
        return res.end('ok');
    }

    if (reqUrl.pathname === '/download') {
        const targetUrl = reqUrl.searchParams.get('url');
        const filename = reqUrl.searchParams.get('filename') || 'PulseLoad_Video.mp4';
        
        fetchVideo(targetUrl, res, filename);
    } else {
        res.end('PulseLoad Backend is running!');
    }
}).listen(PORT, () => console.log(`Server active on port ${PORT}`));
