const fs = require("fs");
let content = fs.readFileSync("functions/src/index.ts", "utf8");
const targetRegex = /const response = await model\.generateContent\(\[\s*{\s*text:\s*"You are an expert pricing estimator that outputs pure JSON arrays\."\s*},\s*{\s*text:\s*prompt\s*}\s*\]\);/;
const fallback = `let response;
        try {
            response = await model.generateContent([
                { text: "You are an expert pricing estimator that outputs pure JSON arrays." },
                { text: prompt }
            ]);
        } catch (error: any) {
            if (error.message?.includes("429") || error.status === 429) {
                functions.logger.warn("429 Too Many Requests on gemini-2.0-flash, falling back to gemini-1.5-flash");
                const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                response = await fallbackModel.generateContent([
                    { text: "You are an expert pricing estimator that outputs pure JSON arrays." },
                    { text: prompt }
                ]);
            } else {
                throw error;
            }
        }`;
content = content.replace(targetRegex, fallback);
fs.writeFileSync("functions/src/index.ts", content);
console.log("Replaced");
