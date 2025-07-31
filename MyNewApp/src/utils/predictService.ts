// utils/predictService.ts
export const sendWindowToBackend = async (sequence: number[]) => {
    try {
        const res = await fetch('http://<your-ip>:8000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sequence }),
        });
        const result = await res.json();
        return result.anomaly;
    } catch (err) {
        console.error("Prediction failed", err);
        return false;
    }
};
