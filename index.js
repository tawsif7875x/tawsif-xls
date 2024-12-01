const express = require('express');
const axios = require('axios');
const app = express();
const port = 3956;

app.get('/xl', async (req, res) => {
    try {
        const text = req.query.prompt;
        if (!text) {
            return res.status(400).send("Provide a prompt.");
        }

        const { ratio, lora1, lora2, lora3, prompt, model } = filterCnv(text);
        const { width, height } = ratioCnv(ratio);

        const imageUrl = await generateImage(width, height, prompt, lora1, lora2, lora3, model);
        res.json({ imageUrl });
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

async function generateImage(width, height, prompt, lora1, lora2, lora3, model) {
    const requestId = randomId();
    const response = await axios.post('https://ap-east-1.tensorart.cloud/v1/jobs', {
        requestId: requestId,
        stages: [
            {
                type: "INPUT_INITIALIZE",
                inputInitialize: {
                    seed: "-1",
                    count: 1
                }
            },
            {
                type: "DIFFUSION",
                diffusion: {
                    width: width,
                    height: height,
                    prompts: [{ text: prompt }],
                    negativePrompts: [{ text: "High quality, realistic" }],
                    sdModel: model,
                    sdVae: "Automatic",
                    sampler: "DPM++ 2M Karras",
                    steps: 25,
                    cfgScale: 5,
                    clipSkip: 7,
                    etaNoiseSeedDelta: 0,
                    lora: { 
                        items: [
                            { loraModel: lora1, weight: 0.9 },
                            { loraModel: lora2, weight: 0.9 },
                            { loraModel: lora3, weight: 0.9 }
                        ] 
                    }
                }
            },
            {
                type: "IMAGE_TO_UPSCALER",
                image_to_upscaler: {
                    hr_upscaler: "R-ESRGAN 4x+",
                    hr_scale: 1.5,
                    hr_second_pass_steps: 15,
                    denoising_strength: 0.39
                }
            }
        ],
        engine: "TAMS_V2"
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 9f09e7fb-21cb-4808-a7be-462d9026d4dc'
        }
    });

    const jobId = response.data.job.id;
    const jobDetails = await getJobDetails(jobId);
    if (jobDetails.job.successInfo && jobDetails.job.successInfo.images.length > 0) {
        return jobDetails.job.successInfo.images[0].url;
    } else {
        throw new Error("No image found.");
    }
}

async function getJobDetails(jobId) {
    try {
        while (true) {
            const response = await axios.get(`https://ap-east-1.tensorart.cloud/v1/jobs/${jobId}`, {
                headers: {
                    'Authorization': 'Bearer 9f09e7fb-21cb-4808-a7be-462d9026d4dc'
                }
            });

            if (response.data.job.status === "SUCCESS") {
                return response.data;
            }

            await new Promise(resolve => setTimeout(resolve, 20000));
        }
    } catch (error) {
        throw error;
    }
}

function filterCnv(text) {
    const ratioFlagIndex = text.indexOf("--ar");
    const lora1FlagIndex = text.indexOf("--lora1");
    const lora2FlagIndex = text.indexOf("--lora2");
    const lora3FlagIndex = text.indexOf("--lora3"); // Added for third Lora
    const modelFlagIndex = text.indexOf("--model");

    let prompt = text;
    let ratio = "1:1";
    let lora1 = "";
    let lora2 = "";
    let lora3 = ""; // Default for third Lora
    let model = "";

    if (ratioFlagIndex !== -1) {
        const ratioStartIndex = ratioFlagIndex + 5;
        const ratioEndIndex = text.indexOf(" ", ratioStartIndex);
        const ratioText = ratioEndIndex !== -1 ? text.substring(ratioStartIndex, ratioEndIndex).trim() : text.substring(ratioStartIndex).trim();
        const ratioRegex = /(\d+):(\d+)/;
        const ratioMatch = ratioText.match(ratioRegex);

        if (ratioMatch) {
            ratio = ratioMatch[1] + ':' + ratioMatch[2];
            prompt = text.replace(/--ar\s+\S+/, '').trim();
        }
    }

    if (lora1FlagIndex !== -1) {
        const lora1StartIndex = lora1FlagIndex + 7;
        const lora1EndIndex = text.indexOf("--", lora1StartIndex);
        if (lora1EndIndex !== -1) {
            lora1 = text.substring(lora1StartIndex, lora1EndIndex).trim();
            prompt = text.substring(0, lora1FlagIndex).trim() + " " + text.substring(lora1EndIndex).trim();
        } else {
            lora1 = text.substring(lora1StartIndex).trim();
            prompt = text.substring(0, lora1FlagIndex).trim();
        }
    }

    if (lora2FlagIndex !== -1) {
        const lora2StartIndex = lora2FlagIndex + 7;
        const lora2EndIndex = text.indexOf("--", lora2StartIndex);
        if (lora2EndIndex !== -1) {
            lora2 = text.substring(lora2StartIndex, lora2EndIndex).trim();
            prompt = text.substring(0, lora2FlagIndex).trim() + " " + text.substring(lora2EndIndex).trim();
        } else {
            lora2 = text.substring(lora2StartIndex).trim();
            prompt = text.substring(0, lora2FlagIndex).trim();
        }
    }

    if (lora3FlagIndex !== -1) {
        const lora3StartIndex = lora3FlagIndex + 7;
        const lora3EndIndex = text.indexOf("--", lora3StartIndex);
        if (lora3EndIndex !== -1) {
            lora3 = text.substring(lora3StartIndex, lora3EndIndex).trim();
            prompt = text.substring(0, lora3FlagIndex).trim() + " " + text.substring(lora3EndIndex).trim();
        } else {
            lora3 = text.substring(lora3StartIndex).trim();
            prompt = text.substring(0, lora3FlagIndex).trim();
        }
    }

    const modelRegex = /--model\s+(\d+)/;
    const modelMatch = text.match(modelRegex);

    if (modelMatch) {
        model = modelMatch[1];
        prompt = text.replace(/--model\s+\S+/, '').trim();
    }

    prompt = prompt.replace(/--\w+\s+\S+/g, '').trim();
    return { ratio, lora1, lora2, lora3, model, prompt }; // Added lora3 to the return
}

function ratioCnv(ratio) {
    const [widthRatio, heightRatio] = ratio.split(":").map(Number);
    const maxWidth = 2048;
    const width = maxWidth / (widthRatio + heightRatio) * widthRatio;
    const height = width / widthRatio * heightRatio;
    return { width: Math.round(width), height: Math.round(height) };
}

function randomId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
