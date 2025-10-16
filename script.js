(async () => {
    if (typeof tmImage === "undefined") {
        console.error("tmImage is not loaded! Check your script tag in HTML.");
        return;
    }
 
    const URL = "my_model/";
 
    const sounds = {
        "Start": new Audio("my_sounds/Dancer.mp3"),
        "Dance": new Audio("my_sounds/Music.mp3"),
        "High_Five": new Audio("my_sounds/Win.mp3")
    };

    const images = {
        "Start": "my_images/neutraal.png",
        "Dance": "my_images/giphy.gif",
        "Win": "my_images/neutraal2.png",
        "Neutral": "my_images/neutraal3.png"
    };
 
    let model = null;
    let webcam = null;
 
    const confidenceThreshold = 0.9;
    const maxThreshold = 1.0;
    const holdTime = 2000;
    const cooldown = 4000;
    const bufferSize = 5;
    const displayHoldDuration = 5000;
    const neutralHoldDuration = 500;
 
    const holdStart = {};
    const lastPlayed = {};
    const predictionBuffer = {};
    let currentDetectedClass = null;
    let lastDetectionTime = 0;
    let lastNeutralTime = 0;
 
    const imageDiv = document.getElementById("image-display");
    const predictionText = document.getElementById("prediction");
    const startBtn = document.getElementById("start-btn");
 
    // ✅ Unlock audio on first tap (mobile)
    document.body.addEventListener("click", () => {
        Object.values(sounds).forEach(sound => {
            sound.play().then(() => sound.pause());
        });
    }, { once: true });
 
    // Load model first
    try {
        model = await tmImage.load(URL + "model.json", URL + "metadata.json");
        console.log("Model loaded!");
    } catch (err) {
        console.error("Model loading failed:", err);
        predictionText.innerText = "Kon het model niet laden";
        return;
    }
 
    // Start camera on user click
    startBtn.addEventListener("click", async () => {
        startBtn.style.display = "none";
        try {
            webcam = new tmImage.Webcam(400, 300, true, { facingMode: "user" });
            await webcam.setup(); // user gesture required for iOS
            await webcam.play();
            const container = document.getElementById("webcam-container");
            container.appendChild(webcam.canvas);
 
            // iOS-specific attributes
            webcam.canvas.setAttribute("autoplay", "");
            webcam.canvas.setAttribute("playsinline", "");
 
            console.log("Webcam ready!");
            loop();
        } catch (err) {
            console.error("Webcam initialization failed:", err);
            alert("Camera kon niet worden gestart. Controleer je browserinstellingen.");
            startBtn.style.display = "block";
        }
    });
 
    async function loop() {
        webcam.update();
        if (model) await predict();
        requestAnimationFrame(loop);
    }
 
    async function predict() {
        try {
            const prediction = await model.predict(webcam.canvas);
 
            let highest = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
            const className = highest.className;
            const prob = highest.probability;
 
            if (!predictionBuffer[className]) predictionBuffer[className] = [];
            predictionBuffer[className].push(prob);
            if (predictionBuffer[className].length > bufferSize) predictionBuffer[className].shift();
            const avgProb = predictionBuffer[className].reduce((a, b) => a + b, 0) / predictionBuffer[className].length;
 
            const now = Date.now();
 
            if (currentDetectedClass && now - lastDetectionTime < displayHoldDuration) {
                predictionText.innerText = `Gedetecteerd: ${currentDetectedClass}`;
                return;
            }
 
            if (avgProb < confidenceThreshold) {
                if (!currentDetectedClass || now - lastNeutralTime > neutralHoldDuration) {
                    predictionText.innerText = "Geen hand herkend...";
                    imageDiv.innerHTML = `<img src="${images["Neutral"]}" alt="Neutral">`;
                    currentDetectedClass = null;
                    lastNeutralTime = now;
                }
                return;
            }
 
            predictionText.innerText = `Gedetecteerd: ${className} (${(avgProb * 100).toFixed(2)}%)`;
 
            if (sounds[className] && avgProb >= confidenceThreshold && avgProb <= maxThreshold) {
                if (!holdStart[className]) holdStart[className] = now;
 
                if (now - holdStart[className] >= holdTime) {
                    if (!lastPlayed[className] || now - lastPlayed[className] > cooldown) {
                        sounds[className].play();
                        lastPlayed[className] = now;
 
                        imageDiv.innerHTML = `<img src="${images[className]}" alt="${className}">`;
                        currentDetectedClass = className;
                        lastDetectionTime = now;
                    }
                    holdStart[className] = null;
                }
            } else {
                holdStart[className] = null;
            }
 
        } catch (err) {
            console.error("Prediction failed:", err);
        }
    }
})();