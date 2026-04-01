async function testCF() {
    console.log("Starting CF invocation...");
    try {
        const response = await fetch('https://us-central1-tektrakker.cloudfunctions.net/callGeminiAI', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                data: { 
                    prompt: "Write a 1-sentence marketing pitch.", 
                    modelName: "gemini-3-pro-preview" 
                } 
            })
        });
        
        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testCF();
