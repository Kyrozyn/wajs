const {Client} = require('whatsapp-web.js');
const client = new Client();
const {Grammarly} = require('@stewartmcgown/grammarly-api')
const pdf = require('pdf-parse')
const qrcode = require('qrcode-terminal');
const fs = require('fs')
const fetch = require("node-fetch");



client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, {small: true})
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async msg => {
    console.log(msg)
    if(msg.hasMedia){
        //Jika yang diterima file

        //download file
        const media = await msg.downloadMedia();
        //convert file
        let buff = Buffer.from(media.data,'base64');
        //baca pdf
        pdf(buff).then(function(datapdf){
            console.log(datapdf.text)
            //cari posisi kata abstrak
            const abstractposisi = datapdf.text.search('Abstract');
            //cari posisi kata keywords:
            const keywordsposisi = datapdf.text.search('Keywords:');
            //potong kalimat (hanya abstrak)
            const slice = datapdf.text.slice(abstractposisi,keywordsposisi);
            console.log(slice)
            //cek grammar
            const free = new Grammarly();
            //hapus baris baru (enter) regular expression
            const slicetextnewline = slice.replace(/(\r\n|\n|\r)/gm, " ");
            //hapus spasi double regular expression
            const slicetextdoublespace = slicetextnewline.replace(/ +(?= )/g,'');
            console.log("trimmed:" + slicetextdoublespace);
            const results = free.analyse(slicetextdoublespace);
            //kirim hasil deteksi grammar
            results.then((gmres) => {
                gmres.alerts.forEach((item, index) => {
                        client.sendMessage(msg.from, `*Correction* :
                        ${item.title}
                        ${item.group}
                        Text : ${item.text}
                        ====
                        ${item.details}
                        ${item.explanation}
                        ${item.cardLayout.groupDescription}
                        `);
                })
                if(gmres.alerts.length == 0){
                    client.sendMessage(msg.from,'Grammar anda sudah benar!')
                }
            })
        })
        .catch((reason)=>{
            console.log(reason)
        })
        
        // console.log(media);
    }
    switch (msg.body) {
        case 'ping':
            msg.reply('ping')
            break;
        case '!info':
            let info = client.info;
            client.sendMessage(msg.from, `
            *Connection info*
            User name: ${info.pushname}
            My number: ${info.me.user}
            Platform: ${info.platform}
            WhatsApp version: ${info.phone.wa_version}
        `);
            break;
    }
    if (msg.body.startsWith('!grammar ')) {
        const free = new Grammarly();
        const text = msg.body.slice(9);
        const results = free.analyse(text);
        console.log('Grammar check : '+text)
        results.then((gmres) => {
            gmres.alerts.forEach((item, index) => {
                    client.sendMessage(msg.from, `*Correction* :
                    ${item.title}
                    ${item.group}
                    Text : ${item.text}
                    ====
                    ${item.details}
                    ${item.explanation}
                    ${item.cardLayout.groupDescription}
                    `);
            })
            if(gmres.alerts.length == 0){
                client.sendMessage(msg.from,'Grammar anda sudah benar!')
            }
        })
    }
});

client.initialize();