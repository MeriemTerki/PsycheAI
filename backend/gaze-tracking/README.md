

## Prerequisites
- Docker iDesktop opened 
- Virtual environment (venv) set up


1. **Activate the Virtual Environment**  
   In your terminal, run:
   ```bash
   venv\Scripts\activate

2. **Pull and Run Roboflow Inference Server**
In the same terminal, execute:

```bash
docker pull roboflow/roboflow-inference-server-cpu
docker run -it --rm -p 9001:9001 roboflow/roboflow-inference-server-cpu
```

3. **Open a New Terminal**
Keep the first terminal running and open a new terminal window.

4. **Activate Virtual Environment in New Terminal**
```bash
venv\Scripts\activate
```

5. ** Run the Gaze Detection Script**
In the new terminal, execute:

```bash
python gaze.py
``` 
