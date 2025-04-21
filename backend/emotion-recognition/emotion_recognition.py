from ultralytics import YOLO
import cv2
import pandas as pd
from datetime import datetime

# Load the model
model = YOLO("models/best_v3.pt")

# Initialize video capture (webcam)
cap = cv2.VideoCapture(0)

# List to collect emotion data
data = []

print("📷 Starting webcam... Press 'q' to stop recording and save data.")

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to read from webcam.")
            break

        # Run prediction
        results = model.predict(source=frame, conf=0.5, stream=False, verbose=False)

        # Show frame
        cv2.imshow("Emotion Detection", frame)

        # Extract results
        for r in results:
            if r.boxes is not None:
                for box in r.boxes:
                    cls = int(box.cls[0])  # class ID
                    conf = float(box.conf[0])  # confidence
                    label = model.names[cls]  # class name
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    data.append({
                        "timestamp": timestamp,
                        "emotion": label,
                        "confidence": conf
                    })

        # Exit loop when 'q' is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("🛑 'q' pressed. Exiting...")
            break

except KeyboardInterrupt:
    print("⛔ Interrupted manually.")

finally:
    cap.release()
    cv2.destroyAllWindows()

    # Save to CSV
    if data:
        df = pd.DataFrame(data)
        df.to_csv("emotion_predictions.csv", index=False)
        print("✅ Data saved to 'emotion_predictions.csv'")
    else:
        print("⚠️ No data collected.")
