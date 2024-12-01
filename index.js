const axios = require('axios');
const express = require('express');
const app = express();
const port = 3000;

app.get('/xl', async (req, res) => {
    const { prompt } = req.query;
    
    async function query(data) {
        try {
            const response = await axios.post(
                "https://api-inference.huggingface.co/models/prithivMLmods/Flux-Dev-Real-Anime-LoRAl",
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
        
      
        res.setHeader('Content-Type', 'image/png');

        imageData.data.pipe(res).on('error', (err) => {
            console.error('Error sending the image:', err);
            res.status(500).send('Error sending the image');
        });

        imageData.data.on('end', () => {
            console.log('Image sent to client');
        });

    } catch (error) {
        res.status(500).send('Error processing the request');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
