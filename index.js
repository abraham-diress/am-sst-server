const express = require("express");
const speech = require("@google-cloud/speech");
const { Translate } = require("@google-cloud/translate").v2;
const { OpenAI } = require("openai");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Load API keys from api-keys.json
const apiKeyFile = "./api-keys.json";
const apiKeys = JSON.parse(fs.readFileSync(apiKeyFile));

const GOOGLE_APPLICATION_CREDENTIALS = "./pull.json";
const googleCredentials = JSON.parse(
  fs.readFileSync(GOOGLE_APPLICATION_CREDENTIALS)
);

const speechClient = new speech.SpeechClient({
  credentials: googleCredentials,
});
const translate = new Translate({ credentials: googleCredentials });
const openai = new OpenAI({ apiKey: apiKeys.OPENAI_API_KEY });

const requestConfig = {
  config: {
    languageCode: "am-ET",
  },
};

app.post("/process_audio", async (req, res) => {
  const audioContent = req.body.audioContent; // Assuming audioContent is sent as base64 string
  console.log("Audio content length:", audioContent.length);
  try {
    const [response] = await speechClient.recognize({
      audio: { content: audioContent },
      config: requestConfig.config,
    });

    const transcription = response.results
      .map((result) => result.alternatives[0].transcript)
      .join("\n");

    console.log(transcription);

    const [translation] = await translate.translate(transcription, "en");
    const openAIResponse = await queryOpenAI(translation);
    console.log(openAIResponse);
    const [finalTranslation] = await translate.translate(openAIResponse, "am");

    // Assuming finalTranslation is an array and you want to send the first item
    const translationToSend = Array.isArray(finalTranslation)
      ? finalTranslation[0]
      : finalTranslation;

    res.json({ translatedText: translationToSend });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request");
  }
});

async function queryOpenAI(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "The request comes from a low accuracy Amharic speech to text system...",
        },
        { role: "user", content: prompt },
      ],
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error querying OpenAI:", error);
    throw error;
  }
}

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}.`);
});
