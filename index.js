const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const {Server} = require("socket.io");
const fs = require("fs");
const io = new Server(server);
const {DateTime} = require("luxon");
var _ = require('lodash');

let fileStreams = {};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const getFileName = (clientId) => {
    const currentTime = DateTime.now().toFormat('LL-dd-HH-mm-ss');
    return `videos1/${clientId}_${currentTime}.webm`;
}

const getFileStream = (id) => {
    if (fileStreams.hasOwnProperty(id + '')) {
        return fileStreams[id + ''];
    }

    const filepath = getFileName(id);
    fs.closeSync(fs.openSync(filepath, 'w'));

    fileStreams[id + ''] = {
        id,
        filepath,
        fileStream: fs.createWriteStream(filepath, {flags: 'a'})
    };

    return fileStreams[id + ''];
}

io.on('connection', (socket) => {
    console.log('a user connected', socket.client.id);
    let userFileStreams = {};
    let lastOrder;
    let msgs = [];
    socket.on('disconnect', () => {
        console.log('user disconnected');
        _.forEach(userFileStreams, (_fileStream) => {
            _fileStream.fileStream?.end(()=>{
                _fileStream.fileStream = null;
            });

            const regex = new RegExp('(.*)(_)(.*)(\.webm)');
            const rea = regex.exec(_fileStream.filepath);

            if (Array.isArray(rea) && rea.length === 5) {
                const newPath = `${rea[1]}${rea[2]}${rea[3]}_${DateTime.now().toFormat('LL-dd-HH-mm-ss')}${rea[4]}`
                fs.renameSync(_fileStream.filepath, newPath);
            }
            delete fileStreams[_fileStream.id + ''];
        })
    });
    socket.on('screen_data', (msg) => {
        if(!msg?.id){
            console.error('msg must have id');
        }
        // check bi ngat quang
        if(msg.order > 0 && (typeof lastOrder === 'undefined' || msg.order - lastOrder > 2)){
            console.error(`ERROR =>>>>>>> bi ngat quang msg order ${msg.order} - last order ${lastOrder}`);
            socket.emit('server_want_force_restart');

            return;
        }


        console.log(`id: ${msg.id} - order: ${msg.order} - lastorder: ${lastOrder}`);
        const fileStream = getFileStream(msg.id);
        userFileStreams[msg.id + ""] = fileStream;
        if (msg.order === 0) {
            lastOrder = 0;
            fileStream.fileStream.write(msg.data, (error => {
                if (error)
                    console.log(`write error ${msg.order}`);
            }));
            console.log(`create new ${fileStream.filepath}`);
        } else {
            if (msg.order - lastOrder === 1) {
                fileStream.fileStream.write(msg.data, (error => {
                    if (error)
                        console.log(`write error ${msg.order}`);
                }));
                lastOrder = msg.order;
                console.log(`write continue ${msg.order}`);
            } else {
                msgs.push(msg);
                msgs = _.sortBy(msgs, 'order');
                msgs.forEach((_msg) => {
                    if (msg.order - lastOrder === 1) {
                        fileStream.fileStream.write(msg.data, (error => {
                            if (error)
                                console.log(`write error ${msg.order}`);
                        }));
                        lastOrder = msg.order;
                        console.log(`write continue ${msg.order}`);
                    }
                })
            }
        }
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
