const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

// This function follows YouTube's forwarding addresses until it finds the real video
function fetchVideo(videoUrl, res, filename, redirectCount = 0) {
    if (redirectCount > 5) {
        res.writeHead(500);
        return res.end('Too many redirects');
    }

    https.get(videoUrl, (streamRes) => {
        // If the server says "Moved" (status 300-399), follow the new location link
        if (streamRes.statusCode >= 300 && streamRes.statusCode < 400 && streamRes.headers.location) {
            return fetchVideo(streamRes.headers.location, res, filename, redirectCount + 1);
        }

        // Once we hit the real file, pipe it to the browser
        res.writeHead(200, {
            'Content-Type': streamRes.headers['content-type'] || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
        });
        streamRes.pipe(res);
    }).on('error', () => {
        res.writeHead(500);
        res.end('Download failed');
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
