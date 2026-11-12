const http = require('http');
const { Readable } = require('stream');

const PORT = process.env.PORT || 3000;

// YouTube Shorts, youtu.be aur normal links se 11-character Video ID nikalne ke liye
function extractYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

// Backend par hi YouTube Video + Audio ko merge karke unlocked CDN link lene ke liye
async function getConvertedYouTubeUrl(cleanYtUrl, format) {
    const hosts = ['https://p.oceansaver.in', 'https://p.savenow.to'];
    for (const host of hosts) {
        try {
            const initUrl = `${host}/ajax/download.php?copyright=0&format=${encodeURIComponent(format)}&url=${encodeURIComponent(cleanYtUrl)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;
            const initRes = await fetch(initUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            const initData = await initRes.json();
            if (!initData || !initData.success || !initData.id) continue;

            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 1500));
                const progRes = await fetch(`${host}/ajax/progress.php?id=${encodeURIComponent(initData.id)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const progData = await progRes.json();
                if (progData && progData.progress >= 1000 && progData.download_url) {
                    return progData.download_url;
                }
            }
        } catch (err) {
            console.error(`Converter error on ${host}:`, err.message);
        }
    }
    return null;
}

http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');

    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (reqUrl.pathname === '/ping') {
        res.writeHead(200);
        return res.end('ok');
    }

    if (reqUrl.pathname === '/download') {
        const targetUrl = reqUrl.searchParams.get('url') || '';
        const ytUrl = reqUrl.searchParams.get('ytUrl') || '';
        const format = reqUrl.searchParams.get('format') || '720';
        const filename = reqUrl.searchParams.get('filename') || 'PulseLoad_Video.mp4';

        // 1. Direct Stream (Instagram Reels aur progressive streams ke liye)
        if (targetUrl && !targetUrl.includes('aitags=')) {
            try {
                const directRes = await fetch(targetUrl, {
                    redirect: 'follow',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Accept': '*/*'
                    }
                });
                const contentLen = parseInt(directRes.headers.get('content-length') || '0', 10);
                const contentType = directRes.headers.get('content-type') || '';

                if (directRes.ok && (contentLen > 10000 || (!ytUrl.includes('youtu') && !contentType.includes('text/html')))) {
                    res.writeHead(200, {
                        'Content-Type': contentType || 'application/octet-stream',
                        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
                    });
                    return Readable.fromWeb(directRes.body).pipe(res);
                }
            } catch (err) {
                console.log('Direct fetch failed, switching to YouTube converter...');
            }
        }

        // 2. YouTube Converter Engine (Shorts aur Videos ke liye audio ke saath MP4/MP3)
        const videoId = extractYouTubeId(ytUrl);
        if (videoId) {
            try {
                const cleanYtUrl = `https://www.youtube.com/watch?v=${videoId}`;
                const convertedUrl = await getConvertedYouTubeUrl(cleanYtUrl, format);

                if (convertedUrl) {
                    const cdnRes = await fetch(convertedUrl, {
                        redirect: 'follow',
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });

                    if (cdnRes.ok) {
                        res.writeHead(200, {
                            'Content-Type': cdnRes.headers.get('content-type') || 'application/octet-stream',
                            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`
                        });
                        return Readable.fromWeb(cdnRes.body).pipe(res);
                    }
                }
            } catch (err) {
                console.error('YouTube stream error:', err.message);
            }
        }

        res.writeHead(502);
        return res.end('Failed to extract playable media stream');
    }

    res.writeHead(200);
    res.end('PulseLoad Backend is running!');
}).listen(PORT, () => console.log(`Server active on port ${PORT}`));
