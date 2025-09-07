const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const SAVE_FILE = path.join(__dirname, 'saved_map.json');

// Enable CORS for all requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const server = http.createServer((req, res) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    // Add CORS headers to all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    if (req.url === '/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const mapData = JSON.parse(body);
                fs.writeFileSync(SAVE_FILE, JSON.stringify(mapData, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Map saved successfully!' }));
                console.log('Map saved successfully');
            } catch (error) {
                console.error('Error saving map:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to save map' }));
            }
        });
    } else if (req.url === '/load' && req.method === 'GET') {
        try {
            if (fs.existsSync(SAVE_FILE)) {
                const mapData = fs.readFileSync(SAVE_FILE, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ mapData: JSON.parse(mapData) }));
                console.log('Map loaded successfully');
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'No saved map found' }));
            }
        } catch (error) {
            console.error('Error loading map:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to load map' }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  POST /save - Save mind map data');
    console.log('  GET /load - Load mind map data');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});