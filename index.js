const {Client} = require('whatsapp-web.js');
const client = new Client();
const {correct, Grammarly} = require('@stewartmcgown/grammarly-api')
const pdf = require('pdf-parse')
const qrcode = require('qrcode-terminal');
const fs = require('fs')
const fetch = require("node-fetch");
const mysql = require('mysql');

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'logsbot'
  });


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
                client.sendMessage(msg.from, `*Teks sebelum dikoreksi* :
                                ${slicetextdoublespace}`);
                if(gmres.alerts.length == 0){
                    client.sendMessage(msg.from,'Grammar anda sudah benar!')
                }
                else{
                    const corrected = new Grammarly().analyse(slicetextdoublespace).then(correct);
                    corrected.then((text)=>{
                        client.sendMessage(msg.from, `*Teks yang sudah dikoreksi* :
                                ${text.corrected    }`);
                        console.log("koreksi :"+text.corrected)
                        
                        let data = {created_at: Date.now(),request_number: msg.from, text_before: slicetextdoublespace, text_after: text.corrected};
                        let sql = "INSERT INTO logs SET ?";
                        let query = conn.query(sql, data,(err, results) => {
                            if(err) console.log(err);
                        });
                    })
                    
                }                
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
                        let data = {title: item.title, group: item.group, text: item.text, detail: item.details, explanation: item.explanation, groupdescription: item.cardLayout.groupDescription, request_number: msg.from};
                        let sql = "INSERT INTO corrections SET ?";
                        let query = conn.query(sql, data,(err, results) => {
                            if(err) console.log(err);
                        });
                })
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
            if(gmres.alerts.length == 0){
                client.sendMessage(msg.from,'Grammar anda sudah benar!')
            }
            else{
                const corrected = new Grammarly().analyse(text).then(correct);
                corrected.then((text)=>{
                    client.sendMessage(msg.from, `*Teks yang sudah dikoreksi* :
                            ${text.corrected    }`);
                    console.log("koreksi :"+text.corrected) 
                    let data = {created_at: Date.now(), request_number: msg.from, text_before: slicetextdoublespace, text_after: text.corrected};
                        let sql = "INSERT INTO logs SET ?";
                        let query = conn.query(sql, data,(err, results) => {
                            if(err) console.log(err);
                        });       
                })
            }
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
                    let data = {title: item.title, group: item.group, text: item.text, detail: item.details, explanation: item.explanation, groupdescription: item.cardLayout.groupDescription, request_number: msg.from};
                        let sql = "INSERT INTO corrections SET ?";
                        let query = conn.query(sql, data,(err, results) => {
                            if(err) console.log(err);
                        });
            })
        })
    }
});

client.initialize();