const http = require('http');
const https = require('https');

// Render assigns a port automatically
const PORT = process.env.PORT || 3000;

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

        https.get(targetUrl, (streamRes) => {
            res.writeHead(200, {
                'Content-Type': streamRes.headers['content-type'] || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
            });
            streamRes.pipe(res);
        }).on('error', () => {
            res.writeHead(500);
            res.end('Download failed');
        });
    } else {
        res.end('PulseLoad Backend is running!');
    }
}).listen(PORT, () => console.log(`Server active on port ${PORT}`));
