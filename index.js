const axios = require('axios');
const fs = require('fs'); 
const express = require('express');
const app = express();
const port = 3000;

app.get('/xl', async (req, res) => {
    const { prompt } = req.query;
    
    async function query(data) {
        try {
            const response = await axios.post(
                "https://huggingface.co/cagliostrolab/animagine-xl-3.0",
                data,
                {
                    headers: {
                        Authorization: "Bearer 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",
                        "Content-Type": "application/json",
                    },
                    responseType: 'stream',
                }
            );
            return response;
        } catch (error) {
            console.error('Error querying the API:', error);
            throw error;
        }
    }

    try {
        const imageData = await query({ "inputs": `${prompt}` });
        const filePath = './output.png';
        const writer = fs.createWriteStream(filePath);

       
        imageData.data.pipe(writer);

        writer.on('finish', () => {
            console.log('Image saved as output.png');
            
            
            res.sendFile(filePath, { root: __dirname }, (err) => {
                if (err) {
                    console.error('Error sending the file:', err);
                    res.status(500).send('Error sending the file');
                } else {
                    console.log('Image sent to client');
                }
            });
        });

        writer.on('error', (err) => {
            console.error('Error writing the file:', err);
            res.status(500).send('Error saving the file');
        });

    } catch (error) {
        res.status(500).send('Error processing the request');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
