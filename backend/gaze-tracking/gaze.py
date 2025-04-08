
import base64
import cv2
import numpy as np
import requests
import os

# Set global variables
IMG_PATH = "image.jpg"
API_KEY = os.environ.get("API_KEY", "ZkNMlNnyIa2y7w8zGWMS")
DISTANCE_TO_OBJECT = 1000  # mm
HEIGHT_OF_HUMAN_FACE = 250  # mm
GAZE_DETECTION_URL = f"http://127.0.0.1:9001/gaze/gaze_detection?api_key={API_KEY}"

def detect_gazes(frame: np.ndarray):
    """Detect gaze direction using Roboflow Inference."""
    _, img_encode = cv2.imencode(".jpg", frame)
    img_base64 = base64.b64encode(img_encode).decode("utf-8")
    
    resp = requests.post(
        GAZE_DETECTION_URL,
        json={"image": {"type": "base64", "value": img_base64}},
    )
    
    return resp.json()[0].get("predictions", [])

def draw_gaze(img: np.ndarray, gaze: dict):
    """Draw bounding box, gaze arrow, and keypoints on the image."""
    face = gaze["face"]
    x_min, x_max = int(face["x"] - face["width"] / 2), int(face["x"] + face["width"] / 2)
    y_min, y_max = int(face["y"] - face["height"] / 2), int(face["y"] + face["height"] / 2)
    
    cv2.rectangle(img, (x_min, y_min), (x_max, y_max), (255, 0, 0), 3)
    
    # Draw gaze arrow
    _, imgW = img.shape[:2]
    arrow_length = imgW / 2
    dx = -arrow_length * np.sin(gaze["yaw"]) * np.cos(gaze["pitch"])
    dy = -arrow_length * np.sin(gaze["pitch"])
    
    cv2.arrowedLine(
        img,
        (int(face["x"]), int(face["y"])) ,
        (int(face["x"] + dx), int(face["y"] + dy)),
        (0, 0, 255),
        2,
        cv2.LINE_AA,
        tipLength=0.18,
    )
    
    # Draw keypoints
    for keypoint in face["landmarks"]:
        x, y = int(keypoint["x"]), int(keypoint["y"])
        cv2.circle(img, (x, y), 2, (0, 255, 0), -1)
    
    # Display yaw and pitch
    label = "yaw {:.2f}  pitch {:.2f}".format(
        gaze["yaw"] / np.pi * 180, gaze["pitch"] / np.pi * 180
    )
    cv2.putText(img, label, (x_min, y_min - 10), cv2.FONT_HERSHEY_PLAIN, 2, (255, 0, 0), 2)
    
    return img

if __name__ == "__main__":
    cap = cv2.VideoCapture(0)
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        gazes = detect_gazes(frame)
        
        if gazes:
            draw_gaze(frame, gazes[0])
            
            image_height, image_width = frame.shape[:2]
            length_per_pixel = HEIGHT_OF_HUMAN_FACE / gazes[0]["face"]["height"]
            
            dx = -DISTANCE_TO_OBJECT * np.tan(gazes[0]['yaw']) / length_per_pixel
            dx = dx if not np.isnan(dx) else 100000000
            dy = -DISTANCE_TO_OBJECT * np.arccos(gazes[0]['yaw']) * np.tan(gazes[0]['pitch']) / length_per_pixel
            dy = dy if not np.isnan(dy) else 100000000
            gaze_point = (int(image_width / 2 + dx), int(image_height / 2 + dy))
            
            cv2.circle(frame, gaze_point, 25, (0, 0, 255), -1)
            
            # Define quadrants
            quadrants = [
                ("center", (int(image_width / 4), int(image_height / 4), int(image_width / 4 * 3), int(image_height / 4 * 3))),
                ("top_left", (0, 0, int(image_width / 2), int(image_height / 2))),
                ("top_right", (int(image_width / 2), 0, image_width, int(image_height / 2))),
                ("bottom_left", (0, int(image_height / 2), int(image_width / 2), image_height)),
                ("bottom_right", (int(image_width / 2), int(image_height / 2), image_width, image_height)),
            ]
            
            for quadrant, (x_min, y_min, x_max, y_max) in quadrants:
                if x_min <= gaze_point[0] <= x_max and y_min <= gaze_point[1] <= y_max:
                    # Show quadrant in top left of screen
                    cv2.putText(frame, quadrant, (10, 50), cv2.FONT_HERSHEY_PLAIN, 3, (255, 0, 0), 3)
                    break
        
        cv2.imshow("Gaze Detection", frame)
        
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
    
    cap.release()
    cv2.destroyAllWindows()