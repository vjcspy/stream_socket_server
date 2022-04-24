const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const {Server} = require("socket.io");
const fs = require("fs");
const io = new Server(server);
const { DateTime } = require("luxon");

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const getFileName = (clientId)=>{
    const currentTime = DateTime.now().toFormat('LL-dd-HH-mm-ss');
    return `videos/v_${currentTime}.webm`;
}

io.on('connection', (socket) => {
    console.log('a user connected', socket.client.id);
    const filepath = getFileName(socket.client.id);
    fs.closeSync(fs.openSync(filepath, 'w'));

    const fileStream = fs.createWriteStream(filepath, {flags: 'a'});

    socket.on('disconnect', () => {
        console.log('user disconnected');
        fileStream.end();

        const regex = new RegExp('(.*)(_)(.*)(\.webm)');
        const rea = regex.exec(filepath);

        if(Array.isArray(rea) && rea.length ===  5){
            const newPath = `${rea[1]}${rea[2]}${rea[3]}_${DateTime.now().toFormat('LL-dd-HH-mm-ss')}${rea[4]}`
             fs.renameSync(filepath, newPath);
        }
    });
    socket.on('screen_data', (msg) => {
        console.log('write stream');
        fileStream.write(msg);
        // fileStream.end();
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
